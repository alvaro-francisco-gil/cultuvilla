#!/usr/bin/env node
/**
 * Places gained an optional pin: `coordinates` (GeoPoint | null) and its saved
 * name `locationLabel` (string | null). The place converter is strict, so a doc
 * predating the fields makes every place read throw — this seeds them to null
 * ("nobody has pinned this place yet") on existing docs.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills" and
 * `pnpm backfills:list`.
 *
 *   pnpm backfills:run --id=place-location --env=dev            (dry run)
 *   pnpm backfills:run --id=place-location --env=dev --apply
 */

import { backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'place-location',
  kind: 'backfill',
  description: 'Seed places.coordinates + places.locationLabel to null on docs predating the optional place pin',
  // Adding required (nullable) fields: the shipped converter cannot read a doc
  // without them, so this must land before the deploy that ships it.
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  // Provably additive — it only fills in absent keys, never overwrites a pin.
  autoApply: ['dev', 'beta', 'prod'],
};

function patchFor(data) {
  const patch = {};
  if (data.coordinates === undefined) patch.coordinates = null;
  if (data.locationLabel === undefined) patch.locationLabel = null;
  return patch;
}

export async function run({ db, apply, log }) {
  log('places.coordinates + places.locationLabel');
  // Collection-group: places are nested under every municipality.
  return await backfillCollection(db, 'places', db.collectionGroup('places'), patchFor, { apply });
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
