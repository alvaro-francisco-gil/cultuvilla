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
  description: 'Project persons.municipalityLinks[].barrioId onto municipalityPeople.barrioId for the barrio roster',
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: ['dev', 'beta', 'prod'],
  // Projection: reads persons, writes municipalityPeople. person-visibility
  // patches `persons` itself, which fires syncMunicipalityPeople and rewrites
  // these rows with a full `set()` — so it has to land first or it undoes the
  // barrioId written here. This is the case AGENTS.md records: backfilling
  // persons.isPublic on beta wiped the municipalityPeople rows it had just
  // written. Note `m` sorts before `p`, so plain alphabetical order gets this
  // exactly backwards; the declaration is what makes it safe.
  dependsOn: ['person-visibility'],
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

  // An orphan row (person already deleted) is left alone for the trigger's
  // delete path rather than being patched to a barrio we can't resolve.
  const patchFor = (row) => {
    const person = byId.get(row.personId);
    if (!person) return {};
    const barrioId = barrioFor(person, row.municipalityId);
    return row.barrioId === barrioId ? {} : { barrioId };
  };

  return {
    municipalityPeople: await backfillCollection(
      db,
      'municipalityPeople',
      db.collection('municipalityPeople'),
      patchFor,
      { apply },
    ),
  };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
