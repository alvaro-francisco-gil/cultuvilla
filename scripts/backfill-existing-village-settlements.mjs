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

/**
 * A pre-seed village classified everything it had as a plain `barrio`, because
 * that is the only kind the client can create: `firestore.rules` pins every
 * client-written row to `kind: 'barrio', source: 'user', isSeat: false`. So a
 * hand-made row's kind was never a decision — the UI gave nobody a way to
 * express one — and correcting it against OSM overrides no human choice.
 *
 * Matabuena is the whole of it on prod: "Cañicosa", "Matabuena" and "Matamala"
 * are the municipality's three pedanías, one of them its seat, all three filed
 * under Barrios.
 *
 * PATCHES IN PLACE, NEVER RE-KEYS. Renaming the document to the seed id would
 * be a delete + create, and `barrioId` is a foreign key: `persons.residenceLinks`
 * and `municipalityPeople` point at it and `syncBarrioResidentCount` keys off
 * it. Matabuena's three rows carry 167 residents between them. The id is fine —
 * only two fields are wrong.
 *
 * `source` deliberately stays `'user'`: that provenance is true, and it keeps
 * the row matching by name on every later run, so this stays a no-op.
 */
export function planKindReconciliation(existingBarrios, settlements) {
  const byName = new Map(settlements.map((s) => [normalizeName(s.name), s]));
  const patches = [];
  for (const b of existingBarrios) {
    if (b.source === 'osm') continue;
    const hit = byName.get(normalizeName(String(b.name ?? '')));
    if (!hit) continue;
    const patch = {};
    if ((b.kind ?? 'barrio') !== hit.kind) patch.kind = hit.kind;
    if ((b.isSeat ?? false) !== hit.isSeat) patch.isSeat = hit.isSeat;
    if (Object.keys(patch).length > 0) patches.push({ id: b.id, name: b.name, patch });
  }
  return patches;
}

export async function run({ db, apply, log }) {
  const villages = await municipalitiesCollection(db).where('communityActive', '==', true).get();
  log(`active villages: ${villages.size}`);

  let written = 0;
  let reclassified = 0;
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

    // Correct the rows that were already here before deciding they blocked a
    // seed: a skipped seed and a mis-filed hand-made row are the same row.
    const patches = planKindReconciliation(
      existing.docs.map((d) => ({ id: d.id, ...d.data() })),
      parsed.data.settlements,
    );
    for (const { id, name, patch } of patches) {
      log(`  ${label}: reclassify "${name}" -> ${JSON.stringify(patch)}`);
      if (apply) await barrios.doc(id).update(patch);
      reclassified++;
    }

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
  return { total: villages.size, patched: written + reclassified };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
