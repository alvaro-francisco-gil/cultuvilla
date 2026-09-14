#!/usr/bin/env node
/**
 * Seed `community.fiestas: []` on every municipality whose community is active.
 *
 * `VillageCommunitySchema` now requires the field, and reads go through a
 * strict Zod converter — a community doc without it makes the converter throw
 * and crashes every screen that reads a village. Purely additive: an empty list
 * means "this village has not declared its fiestas", which is the correct
 * starting state and the gate that keeps it out of the Wrapped.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills".
 *
 *   node scripts/backfill-village-fiestas.mjs --env=dev            (dry run)
 *   node scripts/backfill-village-fiestas.mjs --env=dev --apply
 */

import { backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'village-community-fiestas',
  kind: 'backfill',
  description: 'Seed community.fiestas: [] on active communities so the strict converter can read them',
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: ['dev', 'beta', 'prod'],
  dependsOn: [],
};

function patchFor(data) {
  // A dormant municipality has no community object at all — nothing to seed,
  // and writing community.fiestas would resurrect a partial community.
  if (!data.community) return null;
  if (Array.isArray(data.community.fiestas)) return null;
  return { 'community.fiestas': [] };
}

export async function run({ db, apply, log }) {
  log('municipalities.community.fiestas');
  const { total, patched } = await backfillCollection(
    db,
    'municipalities',
    db.collection('municipalities').where('communityActive', '==', true),
    patchFor,
    { apply },
  );
  return { total, patched };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
