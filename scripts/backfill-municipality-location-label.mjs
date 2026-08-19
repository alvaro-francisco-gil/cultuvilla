#!/usr/bin/env node
/**
 * Add `municipalities.locationLabel` — the human-readable name of the village's
 * coordinate — to every doc that predates the field. It is now required (though
 * nullable) on MunicipalityDataSchema, so a doc missing the key throws in the
 * strict converter and crashes every screen that reads a municipality.
 *
 * Existing docs get `null`: their coordinate was picked before names were
 * captured, so there is no name to recover. The village screen simply shows the
 * map without a caption until an organizer re-picks the spot.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills" and
 * `pnpm backfills:list`.
 *
 *   node scripts/backfill-municipality-location-label.mjs --env=dev            (dry run)
 *   node scripts/backfill-municipality-location-label.mjs --env=dev --apply
 *   node scripts/backfill-municipality-location-label.mjs --env=beta --confirm --apply
 */

import { backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'municipality-location-label',
  kind: 'backfill',
  description: 'Add municipalities.locationLabel (null) so the strict converter can read pre-field docs',
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: [],
};

function patchFor(data) {
  return 'locationLabel' in data ? null : { locationLabel: null };
}

export async function run({ db, apply, log }) {
  log('municipalities.locationLabel');
  const { total, patched } = await backfillCollection(
    db,
    'municipalities',
    db.collection('municipalities'),
    patchFor,
    { apply },
  );
  return { total, patched };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
