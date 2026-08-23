#!/usr/bin/env node
/**
 * Collapse `persons.municipalityLinks` to one entry per municipality.
 *
 * The persona residence editor never enforced the one-barrio-per-village rule
 * its own docstring claimed, so a persona could be given two barrios of the
 * same village. That state is not merely redundant — the two consumers of it
 * disagree: `syncMunicipalityPeople` projects a single row per
 * (municipality, person) so only the first barrio ever reaches a roster, while
 * `syncBarrioResidentCount` increments BOTH barrios. The result is a barrio
 * whose residentCount is higher than the list of residents it shows.
 *
 * The tie-break matches the projection's: the first link naming a barrio wins,
 * so a whole-village link can never erase a barrio assignment.
 *
 * Patching the person doc fires `syncBarrioResidentCount`, which diffs the
 * before/after barrio sets and decrements the dropped barrio — so the drifted
 * counts repair themselves and need no second backfill. The projection row is
 * rewritten by `syncMunicipalityPeople` with the same barrio it already had.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills" and
 * `pnpm backfills:list`.
 *
 *   node scripts/backfill-dedupe-residence-links.mjs --env=dev            (dry run)
 *   node scripts/backfill-dedupe-residence-links.mjs --env=dev --apply
 *   node scripts/backfill-dedupe-residence-links.mjs --env=beta --confirm --apply
 */

import { backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'dedupe-residence-links',
  kind: 'cleanup',
  description: 'Collapse persons.municipalityLinks to one link per municipality (one barrio per village)',
  // Nothing in the shipped code fails to READ a duplicated array — the model
  // normalizes on write and the projection already picks one. So this gates no
  // deploy; it repairs data that is already inconsistent with itself.
  phase: 'none',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: ['dev', 'beta', 'prod'],
  dependsOn: [],
};

/**
 * Mirror of `normalizeResidenceLinks` in
 * packages/shared/src/models/person/PersonDataModel.ts. Duplicated rather than
 * imported because backfills run as plain .mjs against the Admin SDK, with no
 * build step over the TypeScript workspace.
 */
function dedupe(links) {
  const byMunicipality = new Map();
  for (const link of links) {
    if (!link || typeof link.municipalityId !== 'string') continue;
    const barrioId = typeof link.barrioId === 'string' ? link.barrioId : null;
    const existing = byMunicipality.get(link.municipalityId);
    if (!existing) {
      byMunicipality.set(link.municipalityId, { municipalityId: link.municipalityId, barrioId });
      continue;
    }
    if (existing.barrioId === null && barrioId !== null) {
      byMunicipality.set(link.municipalityId, { municipalityId: link.municipalityId, barrioId });
    }
  }
  return [...byMunicipality.values()];
}

const sameLinks = (a, b) =>
  a.length === b.length &&
  a.every((l, i) => l.municipalityId === b[i].municipalityId && l.barrioId === b[i].barrioId);

function patchFor(data) {
  const links = data.municipalityLinks;
  if (!Array.isArray(links) || links.length === 0) return null;
  const deduped = dedupe(links);
  return sameLinks(links, deduped) ? null : { municipalityLinks: deduped };
}

export async function run({ db, apply, log }) {
  log('persons.municipalityLinks');
  const { total, patched } = await backfillCollection(
    db,
    'persons',
    db.collection('persons'),
    patchFor,
    { apply },
  );
  return { total, patched };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
