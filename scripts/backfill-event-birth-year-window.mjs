#!/usr/bin/env node
/**
 * Seed the advisory birth-year window introduced with per-event age ranges:
 *
 *   events/{id}.minBirthYear -> null   (no lower bound)
 *   events/{id}.maxBirthYear -> null   (no upper bound)
 *
 * Both carry a `.default(null)` in the strict Zod converter, so a stale doc
 * still parses; the backfill exists so the stored data says what the model
 * means instead of leaning on the default forever, and so the conformance
 * gate has something honest to check.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills".
 *
 *   node scripts/backfill-event-birth-year-window.mjs --env=dev            (dry run)
 *   node scripts/backfill-event-birth-year-window.mjs --env=dev --apply
 *   node scripts/backfill-event-birth-year-window.mjs --env=beta --confirm --apply
 */

import { backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'event-birth-year-window',
  kind: 'backfill',
  description: 'Seed events.minBirthYear/maxBirthYear to null on events predating the field',
  // pre-deploy: additive, and the sign-up sheet reads both fields, so having
  // them stored before the code lands keeps data and model in step.
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: ['dev', 'beta', 'prod'],
  dependsOn: [],
};

function eventPatch(data) {
  const patch = {};
  if (data.minBirthYear === undefined) patch.minBirthYear = null;
  if (data.maxBirthYear === undefined) patch.maxBirthYear = null;
  return Object.keys(patch).length > 0 ? patch : null;
}

export async function run({ db, apply, log }) {
  log('events.minBirthYear / events.maxBirthYear');
  const events = await backfillCollection(db, 'events', db.collection('events'), eventPatch, {
    apply,
  });
  return { events: events.total, eventsPatched: events.patched };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
