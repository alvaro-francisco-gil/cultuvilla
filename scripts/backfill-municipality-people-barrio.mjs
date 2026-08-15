#!/usr/bin/env node
/**
 * Backfills `barrioId` on `municipalityPeople/{id}`, projected from the
 * person's `municipalityLinks` entry for that municipality.
 *
 * The barrio roster now reads this directory instead of querying `persons`
 * directly, so every row needs the field — the schema requires it (strict Zod
 * converter) and the barrio query filters on it. `syncMunicipalityPeople`
 * writes it going forward; this refreshes rows written before the change.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills" and
 * `pnpm backfills:list`.
 *
 *   node scripts/backfill-municipality-people-barrio.mjs --env=dev            (dry run)
 *   node scripts/backfill-municipality-people-barrio.mjs --env=dev --apply
 *   node scripts/backfill-municipality-people-barrio.mjs --env=beta --confirm --apply
 */

import { backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'municipality-people-barrio',
  kind: 'backfill',
  description: 'Project municipalityPeople.barrioId from the person municipalityLinks entry for that municipality',
  // The directory schema requires barrioId and the barrio roster query filters
  // on it, so the rows must carry it before the reading code ships.
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: [],
};

/** Mirrors the trigger: first link naming a barrio wins, else null. */
function barrioFor(person, municipalityId) {
  const links = Array.isArray(person.municipalityLinks) ? person.municipalityLinks : [];
  for (const link of links) {
    if (!link || typeof link !== 'object') continue;
    if (link.municipalityId !== municipalityId) continue;
    if (typeof link.barrioId === 'string' && link.barrioId.length > 0) return link.barrioId;
  }
  return null;
}

export async function run({ db, apply, log }) {
  log('municipalityPeople.barrioId');

  const persons = await db.collection('persons').get();
  const byId = new Map(persons.docs.map((d) => [d.id, d.data()]));

  return await backfillCollection(
    db,
    'municipalityPeople',
    db.collection('municipalityPeople'),
    (row) => {
      const person = byId.get(row.personId);
      if (!person) return null; // orphan row; left for the trigger's delete path
      const barrioId = barrioFor(person, row.municipalityId);
      return row.barrioId === barrioId ? null : { barrioId };
    },
    { apply },
  );
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
