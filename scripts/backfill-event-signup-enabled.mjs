#!/usr/bin/env node
/**
 * Give every event the `signupEnabled` / `signupInfo` pair introduced with
 * "events that take no in-app sign-ups". The schema defaults them to
 * `true` / `null` so reads of pre-field docs parse, but the stored data should
 * match the model rather than lean on the default.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills" and
 * `pnpm backfills:list`.
 *
 *   node scripts/backfill-event-signup-enabled.mjs --env=dev            (dry run)
 *   node scripts/backfill-event-signup-enabled.mjs --env=dev --apply
 *   node scripts/backfill-event-signup-enabled.mjs --env=beta --confirm --apply
 */

import { backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'event-signup-enabled',
  kind: 'backfill',
  description: 'Add signupEnabled: true / signupInfo: null to events created before in-app sign-up could be turned off',
  // firestore.rules now requires both keys on an event create, and the create
  // form always sends them, so the stored shape must lead the deploy.
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: ['dev', 'beta', 'prod'],
};

function patchFor(data) {
  const patch = {};
  if (typeof data.signupEnabled !== 'boolean') patch.signupEnabled = true;
  if (data.signupInfo === undefined) patch.signupInfo = null;
  return Object.keys(patch).length > 0 ? patch : null;
}

export async function run({ db, apply, log }) {
  log('events.signupEnabled + signupInfo');
  const { total, patched } = await backfillCollection(db, 'events', db.collection('events'), patchFor, {
    apply,
  });
  return { total, patched };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
