#!/usr/bin/env node
/**
 * Reduce every stored fiesta block to `{ id, name, month }`.
 *
 * A block used to carry a recurring anchor (month, day, length) and exact
 * per-year windows. The profile now holds only the name and the month; the
 * days of a given year are picked when that year's Wrapped is created and are
 * stored on the Wrapped. The strict converter strips the old keys on read but
 * cannot read a block with no top-level `month`, so every old block is
 * rewritten, keeping its anchor's month.
 *
 * Idempotent: a village whose blocks are already reduced is left untouched.
 * Runs after `village-community-fiestas`, which seeds the array this reshapes.
 *
 *   node scripts/backfill-village-fiestas-month.mjs --env=dev            (dry run)
 *   node scripts/backfill-village-fiestas-month.mjs --env=dev --apply
 */

import { backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'village-fiestas-month',
  kind: 'migration',
  description: 'Reduce community.fiestas blocks to { id, name, month }; days now live on the Wrapped',
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: ['dev', 'beta', 'prod'],
  dependsOn: ['village-community-fiestas'],
};

const isMonth = (m) => Number.isInteger(m) && m >= 1 && m <= 12;

/** A block as `{ id, name, month }`, or null when it has no month to keep. */
export function reduceBlock(block) {
  if (!block || typeof block !== 'object') return null;
  const month = isMonth(block.month) ? block.month : block.anchor?.month;
  if (!isMonth(month) || typeof block.id !== 'string' || typeof block.name !== 'string') return null;
  return { id: block.id, name: block.name, month };
}

export function patchFor(data) {
  const fiestas = data.community?.fiestas;
  if (!Array.isArray(fiestas)) return null;
  const reduced = fiestas.map(reduceBlock).filter((b) => b !== null);
  const unchanged =
    reduced.length === fiestas.length &&
    fiestas.every((b, i) => Object.keys(b).length === 3 && b.month === reduced[i].month);
  return unchanged ? null : { 'community.fiestas': reduced };
}

export async function run({ db, apply, log }) {
  log('municipalities.community.fiestas → { id, name, month }');
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
