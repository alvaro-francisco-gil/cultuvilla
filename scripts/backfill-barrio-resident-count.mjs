#!/usr/bin/env node
/**
 * Recompute the denormalized `residentCount` on every
 * `municipalities/{id}/barrios/{bid}` doc — the field the village hub orders
 * barrios by, kept live by functions/src/village/syncBarrioResidentCount.ts.
 *
 * Counts people whose `municipalityLinks` contains `{ municipalityId, barrioId }`
 * (the same query the old getBarrioResidentCount used), excluding deceased
 * personas — they belong to the cemetery, not the resident count, matching
 * syncBarrioResidentCount. Doubles as a repair tool if the trigger ever drifts.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills" and
 * `pnpm backfills:list`.
 *
 *   node scripts/backfill-barrio-resident-count.mjs --env=dev            (dry run)
 *   node scripts/backfill-barrio-resident-count.mjs --env=dev --apply
 *   node scripts/backfill-barrio-resident-count.mjs --env=beta --confirm --apply
 */

import { activeMunicipalityDocs, backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'barrio-resident-count',
  kind: 'backfill',
  description: 'Recompute barrios.residentCount from living personas linked to each barrio (also repairs trigger drift)',
  // Already applied to every env before the registry existed, so it gates
  // nothing.
  phase: 'none',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: [],
};

async function residentCountFor(db, municipalityId, barrioId) {
  const residents = await db
    .collection('persons')
    .where('municipalityLinks', 'array-contains', { municipalityId, barrioId })
    .get();
  // Deceased personas are excluded (see header) — Firestore can't express this
  // in the aggregation, so we count living docs in JS.
  return residents.docs.filter((doc) => {
    const data = doc.data();
    return data.deathDate == null && data.burialPlace == null;
  }).length;
}

export async function run({ db, apply, log }) {
  log('barrios.residentCount');
  const municipalities = await db.collection('municipalities').get();
  const active = activeMunicipalityDocs(municipalities);
  let total = 0;
  let patched = 0;

  for (const municipality of active) {
    const result = await backfillCollection(
      db,
      `municipalities/${municipality.id}/barrios`,
      municipality.ref.collection('barrios'),
      async (data, docSnap) => {
        const count = await residentCountFor(db, municipality.id, docSnap.id);
        return data.residentCount === count ? null : { residentCount: count };
      },
      // Previously omitted, which defaulted to apply:true — the script wrote on
      // every run and ignored its own --apply flag. There was no dry run.
      { apply },
    );
    total += result.total;
    patched += result.patched;
  }

  log(`${active.length} active of ${municipalities.size} municipalities`);
  return { total, patched, activeMunicipalities: active.length };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
