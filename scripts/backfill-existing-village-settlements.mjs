#!/usr/bin/env node
/**
 * Seed the settlements of villages that were ALREADY active when the OSM
 * settlement dataset shipped.
 *
 * WHY THIS EXISTS
 *   `startVillage` seeds a village's pedanías, aldeas, parroquias and barrios at
 *   the moment it is activated. Every village activated before that code shipped
 *   therefore has none — on prod that was all 17 of them, including Figueruela
 *   de Arriba, the village whose missing localidad started this whole thread.
 *   The reference data was in `_admin/settlements/seeds` and reaching nobody.
 *
 * ADDITIVE ONLY — this is the difference from the activation path.
 *   Activation seeds an empty village, so it can `set()` freely. Here the
 *   village already has content: rows an admin created by hand, possibly with
 *   images, comments and residents attached. So this backfill:
 *     - never writes a document id that already exists, and
 *     - never writes a settlement whose name already exists under any id.
 *   The second rule is the load-bearing one. A hand-made "Cañicosa" has a random
 *   id, while the seed would create `osm-pedania-canicosa` — different ids, same
 *   place. Without the name check the village ends up listing it twice, and the
 *   duplicate is the one with no photos.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills".
 *
 *   node scripts/backfill-existing-village-settlements.mjs --env=dev            (dry run)
 *   node scripts/backfill-existing-village-settlements.mjs --env=dev --apply
 */

import { isMain, runBackfill } from './lib/backfill-harness.mjs';
import {
  municipalitiesCollection,
  municipalityBarriosCollection,
  settlementSeedDoc,
} from '@cultuvilla/shared/firebase/refs/admin';
import { SettlementSeedSchema, settlementSeedId, buildBarrioData } from '@cultuvilla/shared/models';

export const meta = {
  id: 'existing-village-settlements',
  kind: 'backfill',
  description:
    'Seed pedanías/aldeas/parroquias/barrios into villages that were activated before startVillage began seeding them',
  // Nothing crashes without it — those villages simply show no localidades —
  // but the feature is invisible until it runs, and it is purely additive.
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: ['dev', 'beta', 'prod'],
  // The seed documents must exist before this can read them, and existing
  // barrios must already carry kind/source/isSeat before we add siblings that
  // do — otherwise a screen listing both trips the strict converter on the old
  // rows the moment the new ones make it render.
  dependsOn: ['settlement-seeds', 'barrio-kind'],
};

/** Match on the same shape the eye does: accents, case and punctuation aside. */
export function normalizeName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Decide which of a municipality's seed settlements are genuinely new.
 *
 * Pure so the additive-only guarantee — the part that protects hand-made rows
 * from being duplicated or clobbered — is testable without Firestore.
 *
 * `existingBarrios` is `[{ id, name }]` for the rows already in the village.
 */
export function planSettlementWrites(settlements, existingBarrios) {
  const takenIds = new Set(existingBarrios.map((b) => b.id));
  const takenNames = new Set(
    existingBarrios.map((b) => normalizeName(String(b.name ?? ''))).filter(Boolean),
  );

  const toWrite = [];
  let skipped = 0;
  for (const entry of settlements) {
    const id = settlementSeedId(entry.kind, entry.name);
    const key = normalizeName(entry.name);
    if (takenIds.has(id) || takenNames.has(key)) {
      skipped++;
      continue;
    }
    // Two seed entries can normalize to the same name (a barrio and a pedanía
    // both called "El Puente"); keep the first and treat the second as a
    // duplicate rather than writing a row the UI would show twice.
    takenIds.add(id);
    takenNames.add(key);
    toWrite.push({ id, entry });
  }
  return { toWrite, skipped };
}

export async function run({ db, apply, log }) {
  const villages = await municipalitiesCollection(db).where('communityActive', '==', true).get();
  log(`active villages: ${villages.size}`);

  let written = 0;
  let skippedExisting = 0;
  let noSeed = 0;

  for (const village of villages.docs) {
    const municipalityId = village.id;
    const data = village.data();
    const codigoINE = data?.codigoINE;
    const label = `${data?.name ?? municipalityId}`;

    if (!codigoINE) {
      log(`  ${label}: no codigoINE — skipping`);
      noSeed++;
      continue;
    }

    const seedSnap = await settlementSeedDoc(db, codigoINE).get();
    if (!seedSnap.exists) {
      noSeed++;
      continue;
    }
    const parsed = SettlementSeedSchema.safeParse(seedSnap.data());
    if (!parsed.success) {
      log(`  ${label}: seed document failed validation — skipping`);
      noSeed++;
      continue;
    }

    const barrios = municipalityBarriosCollection(db, municipalityId);
    const existing = await barrios.get();
    const { toWrite, skipped } = planSettlementWrites(
      parsed.data.settlements,
      existing.docs.map((d) => ({ id: d.id, name: d.data()?.name })),
    );
    skippedExisting += skipped;

    if (toWrite.length === 0) continue;
    log(`  ${label}: +${toWrite.length} (${existing.size} already present)`);

    // 500 writes per batch is the Firestore limit; Vigo needs two.
    const BATCH_SIZE = 450;
    for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
      const chunk = toWrite.slice(i, i + BATCH_SIZE);
      if (apply) {
        const batch = db.batch();
        for (const { id, entry } of chunk) {
          batch.set(
            barrios.doc(id),
            buildBarrioData({
              name: entry.name,
              municipalityId,
              kind: entry.kind,
              source: 'osm',
              isSeat: entry.isSeat,
              // Nobody proposed these — they are reference data, and a null
              // proposedBy is what the UI reads to omit a "added by" credit.
              proposedBy: null,
            }),
          );
        }
        await batch.commit();
      }
      written += chunk.length;
    }
  }

  log(
    `  ${apply ? 'wrote' : 'would write'} ${written} settlements; ` +
      `${skippedExisting} already present by id or name; ${noSeed} villages without seed data`,
  );
  return { total: villages.size, patched: written };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
