#!/usr/bin/env node
/**
 * Give every existing `municipalities/{id}/barrios/{id}` doc the `kind`,
 * `source` and `isSeat` fields the model now requires.
 *
 * Every row that exists today was created by hand through the admin UI, so it
 * is a neighbourhood: `kind: 'barrio'`, `source: 'user'`, `isSeat: false`. The
 * settlement kinds (`pedania`, `lugar`, `parroquia`) only ever arrive from the
 * OSM seed at village activation, so there is nothing here to classify.
 *
 * `pre-deploy`: BarrioDataSchema now requires all three, and reads go through a
 * strict Zod converter — a doc without them makes the converter throw and
 * crashes every screen that lists barrios.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills".
 *
 *   node scripts/backfill-barrio-kind.mjs --env=dev            (dry run)
 *   node scripts/backfill-barrio-kind.mjs --env=dev --apply
 */

import { isMain, runBackfill } from './lib/backfill-harness.mjs';
import { backfillCollection } from './lib/backfill.mjs';

export const meta = {
  id: 'barrio-kind',
  kind: 'backfill',
  description:
    'Set kind/source/isSeat on existing barrios so the subdivision model can tell a neighbourhood from a pedanía',
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: ['dev', 'beta', 'prod'],
  dependsOn: [],
};

function patchFor(data) {
  const patch = {};
  if (data.kind === undefined) patch.kind = 'barrio';
  if (data.source === undefined) patch.source = 'user';
  if (data.isSeat === undefined) patch.isSeat = false;
  return Object.keys(patch).length > 0 ? patch : null;
}

export async function run({ db, apply, log }) {
  log('barrios.kind + source + isSeat');
  // Barrios are a subcollection, so this is a collection-group sweep rather
  // than a single top-level collection.
  return await backfillCollection(db, 'barrios', db.collectionGroup('barrios'), patchFor, {
    apply,
  });
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
