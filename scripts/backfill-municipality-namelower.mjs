#!/usr/bin/env node
/**
 * Derive `nameLower` from `name` on every municipality doc that lacks it
 * (NFD-decompose, strip combining marks, lowercase) — the search key the
 * municipality lookup queries against.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills" and
 * `pnpm backfills:list`.
 *
 *   node scripts/backfill-municipality-namelower.mjs --env=dev            (dry run)
 *   node scripts/backfill-municipality-namelower.mjs --env=dev --apply
 *   node scripts/backfill-municipality-namelower.mjs --env=beta --confirm --apply
 */

import { backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'municipality-name-lower',
  kind: 'backfill',
  description: 'Derive municipalities.nameLower from name (accent-stripped, lowercased) for the search key',
  // Already applied to every env before the registry existed, so it gates
  // nothing. A NEW backfill adding a required field would be 'pre-deploy'.
  phase: 'none',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: [],
};

function searchKey(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function patchFor(data) {
  if (typeof data.name !== 'string') return null;
  const want = searchKey(data.name);
  return data.nameLower === want ? null : { nameLower: want };
}

export async function run({ db, apply, log }) {
  log('municipalities.nameLower');
  const { total, patched } = await backfillCollection(db, 'municipalities', db.collection('municipalities'), patchFor, {
    apply,
  });
  return { total, patched };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
