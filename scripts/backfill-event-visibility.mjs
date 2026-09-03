#!/usr/bin/env node
/**
 * Give every existing event the two visibility fields introduced with private
 * (organization-scoped) events: `visibility: 'public'` and
 * `visibilityOrgId: null`.
 *
 * `pre-deploy`, because the fields are required by the shipped Zod converter
 * and, more importantly, because every list query over `events` now filters on
 * `visibility` — a doc without the field matches no feed query at all, so an
 * un-backfilled env renders an empty Explora rather than a crash.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills" and
 * `pnpm backfills:list`.
 *
 *   node scripts/backfill-event-visibility.mjs --env=dev            (dry run)
 *   node scripts/backfill-event-visibility.mjs --env=dev --apply
 *   node scripts/backfill-event-visibility.mjs --env=beta --confirm --apply
 */

import { backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'event-visibility',
  kind: 'backfill',
  description: 'Add events.visibility="public" / visibilityOrgId=null so existing events keep matching the feed queries',
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: ['dev', 'beta', 'prod'],
  dependsOn: [],
};

function patchFor(data) {
  const patch = {};
  // Only ever fills a gap: an event already marked private must survive a
  // re-run untouched, which is what makes this safe to auto-apply on prod.
  if (typeof data.visibility !== 'string') patch.visibility = 'public';
  if (data.visibilityOrgId === undefined) patch.visibilityOrgId = null;
  return Object.keys(patch).length > 0 ? patch : null;
}

export async function run({ db, apply, log }) {
  log('events.visibility / events.visibilityOrgId');
  const { total, patched } = await backfillCollection(
    db,
    'events',
    db.collection('events'),
    patchFor,
    { apply },
  );
  return { total, patched };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
