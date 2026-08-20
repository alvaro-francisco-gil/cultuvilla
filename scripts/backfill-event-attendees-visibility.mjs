#!/usr/bin/env node
/**
 * Give every event the `attendeesVisibility` field introduced with the
 * village-visible attendee roster. The schema defaults it to `members` so
 * reads of pre-field docs parse, but the stored data should match the model
 * rather than lean on the default — and firestore.rules now requires the key
 * on an event create.
 *
 * `members` is the default for existing events on purpose: it is what the new
 * create form sends, and the roster it exposes is limited to name + photo +
 * sign-up time, readable only by people who joined that pueblo.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills" and
 * `pnpm backfills:list`.
 *
 *   node scripts/backfill-event-attendees-visibility.mjs --env=dev            (dry run)
 *   node scripts/backfill-event-attendees-visibility.mjs --env=dev --apply
 *   node scripts/backfill-event-attendees-visibility.mjs --env=beta --confirm --apply
 */

import { backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'event-attendees-visibility',
  kind: 'backfill',
  description: 'Add attendeesVisibility: members to events created before the roster was village-visible',
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: ['dev', 'beta', 'prod'],
};

function patchFor(data) {
  return typeof data.attendeesVisibility === 'string' ? null : { attendeesVisibility: 'members' };
}

export async function run({ db, apply, log }) {
  log('events.attendeesVisibility');
  const { total, patched } = await backfillCollection(db, 'events', db.collection('events'), patchFor, {
    apply,
  });
  return { total, patched };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
