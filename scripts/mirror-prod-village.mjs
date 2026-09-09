#!/usr/bin/env node
/**
 * Mirror one village's data from a real environment into the LOCAL EMULATOR, so
 * features can be developed against real shapes, real counts and real
 * distributions instead of invented fixtures.
 *
 * Reads are read-only and may target prod; writes only ever reach an emulator
 * (see `assertEmulatorTarget`). Not a registered backfill — it never mutates a
 * real environment, so it has nothing for the deploy gate to verify.
 *
 *   export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 *   node scripts/mirror-prod-village.mjs --municipality=Matabuena --dry-run
 *   node scripts/mirror-prod-village.mjs --municipality=Matabuena
 *   node scripts/mirror-prod-village.mjs --municipality=Matabuena --anonymize
 */

import admin from 'firebase-admin';
import { ENVS, initAdminForEnv } from './lib/env-credentials.mjs';
import { MIRROR_PLAN, anonymizeDoc, assertEmulatorTarget, parseMirrorArgs } from './lib/mirror-village.mjs';

const TARGET_PROJECT_ID = process.env.MIRROR_TARGET_PROJECT || 'cultuvilla-test';
const REAL_PROJECT_IDS = Object.values(ENVS).map((e) => e.project);
const BATCH_LIMIT = 400;

const log = (...a) => process.stdout.write(a.join(' ') + '\n');

/**
 * firebase-admin routes to the emulator via a process-wide env var, which would
 * capture the SOURCE connection too and silently mirror the emulator onto
 * itself. Capture it, clear it, and re-apply it to the target instance alone.
 */
function splitConnections(sourceEnv) {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '';
  assertEmulatorTarget({ emulatorHost, targetProjectId: TARGET_PROJECT_ID, realProjectIds: REAL_PROJECT_IDS });

  delete process.env.FIRESTORE_EMULATOR_HOST;
  const { app: sourceApp, projectId } = initAdminForEnv(sourceEnv);
  const sourceDb = sourceApp.firestore();

  const targetApp = admin.initializeApp({ projectId: TARGET_PROJECT_ID }, 'mirror-target');
  const targetDb = targetApp.firestore();
  targetDb.settings({ host: emulatorHost, ssl: false });

  return { sourceDb, targetDb, sourceProjectId: projectId, emulatorHost };
}

async function resolveMunicipality(sourceDb, needle) {
  const byId = await sourceDb.collection('municipalities').doc(needle).get();
  if (byId.exists) return byId;

  const snap = await sourceDb
    .collection('municipalities')
    .where('name', '==', needle)
    .limit(2)
    .get();
  if (snap.empty) throw new Error(`No municipality with id or name "${needle}" in the source project.`);
  if (snap.size > 1) throw new Error(`"${needle}" matches more than one municipality — pass the document id instead.`);
  return snap.docs[0];
}

async function writeAll(targetDb, rows, { dryRun }) {
  if (dryRun || rows.length === 0) return rows.length;
  for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
    const batch = targetDb.batch();
    for (const { ref, data } of rows.slice(i, i + BATCH_LIMIT)) batch.set(ref, data);
    await batch.commit();
  }
  return rows.length;
}

function prepare(collection, docs, { anonymize }) {
  return docs.map((d) => ({ id: d.id, data: anonymize ? anonymizeDoc(collection, d.id, d.data()) : d.data() }));
}

async function main() {
  const args = parseMirrorArgs(process.argv.slice(2));
  const { sourceDb, targetDb, sourceProjectId, emulatorHost } = splitConnections(args.source);

  const municipality = await resolveMunicipality(sourceDb, args.municipality);
  const mid = municipality.id;
  const name = municipality.data().name;

  log(`\nMirror  ${name} (${mid})`);
  log(`  from  ${sourceProjectId}  (read-only)`);
  log(`    to  ${TARGET_PROJECT_ID} @ ${emulatorHost}`);
  log(`  mode  ${args.dryRun ? 'DRY RUN — nothing written' : 'writing'}${args.anonymize ? ' · anonymized' : ''}\n`);

  const opts = { anonymize: args.anonymize };
  const totals = {};
  let eventIds = [];
  // Ids harvested from an already-mirrored read model, for 'viaProjection' steps.
  const idsFrom = {};

  for (const step of MIRROR_PLAN) {
    const { collection, scope } = step;
    let rows = [];

    if (scope === 'doc') {
      rows = [{ ref: targetDb.collection('municipalities').doc(mid), data: prepare(collection, [municipality], opts)[0].data }];
    } else if (scope === 'subcollection') {
      const snap = await sourceDb.collection('municipalities').doc(mid).collection(collection).get();
      rows = prepare(collection, snap.docs, opts).map(({ id, data }) => ({
        ref: targetDb.collection('municipalities').doc(mid).collection(collection).doc(id),
        data,
      }));
    } else if (scope === 'municipality') {
      const snap = await sourceDb.collection(collection).where('municipalityId', '==', mid).get();
      const prepared = prepare(collection, snap.docs, opts);
      if (collection === 'events') eventIds = prepared.map((p) => p.id);
      idsFrom[collection] = snap.docs.map((d) => d.data());
      rows = prepared.map(({ id, data }) => ({ ref: targetDb.collection(collection).doc(id), data }));
    } else if (scope === 'perEvent') {
      for (const eventId of eventIds) {
        const snap = await sourceDb.collection('events').doc(eventId).collection(collection).get();
        rows.push(
          ...prepare(collection, snap.docs, opts).map(({ id, data }) => ({
            ref: targetDb.collection('events').doc(eventId).collection(collection).doc(id),
            data,
          })),
        );
      }
    } else if (scope === 'viaProjection') {
      const ids = [...new Set((idsFrom[step.from] ?? []).map((d) => d[step.idField]).filter(Boolean))];
      const refs = ids.map((id) => sourceDb.collection(collection).doc(id));
      const snaps = refs.length > 0 ? await sourceDb.getAll(...refs) : [];
      rows = prepare(collection, snaps.filter((d) => d.exists), opts).map(({ id, data }) => ({
        ref: targetDb.collection(collection).doc(id),
        data,
      }));
    }

    totals[collection] = await writeAll(targetDb, rows, args);
    log(`  ${String(totals[collection]).padStart(5)}  ${collection}`);
  }

  const grand = Object.values(totals).reduce((a, b) => a + b, 0);
  log(`\n  ${grand} documents ${args.dryRun ? 'would be mirrored' : 'mirrored'}.\n`);
  if (!args.anonymize && !args.dryRun) {
    log('  Note: real names were copied verbatim. Re-run with --anonymize to scrub them.\n');
  }
}

main().catch((err) => {
  process.stderr.write(`\n[mirror] ${err.message}\n\n`);
  process.exit(1);
});
