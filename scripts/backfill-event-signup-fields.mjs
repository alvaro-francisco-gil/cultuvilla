#!/usr/bin/env node
/**
 * Give every event the `signupFields` array introduced with custom sign-up
 * questions. The schema defaults it to `[]` so reads of pre-field docs parse,
 * but the stored data should match the model rather than lean on the default.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills" and
 * `pnpm backfills:list`.
 *
 *   node scripts/backfill-event-signup-fields.mjs --env=dev            (dry run)
 *   node scripts/backfill-event-signup-fields.mjs --env=dev --apply
 *   node scripts/backfill-event-signup-fields.mjs --env=beta --confirm --apply
 */

import { backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'event-signup-fields',
  kind: 'backfill',
  description: 'Add signupFields: [] to events created before custom sign-up questions existed',
  // firestore.rules now requires signupFields on an event create, and the
  // create form always sends it, so the stored shape must lead the deploy.
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: [],
};

function patchFor(data) {
  return Array.isArray(data.signupFields) ? null : { signupFields: [] };
}

export async function run({ db, apply, log }) {
  log('events.signupFields');
  const { total, patched } = await backfillCollection(db, 'events', db.collection('events'), patchFor, {
    apply,
  });
  return { total, patched };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
