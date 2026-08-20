#!/usr/bin/env node
/**
 * Seed the group sign-up fields introduced with parejas/grupos:
 *
 *   events/{id}.signupGroupSize            -> 1   (individual sign-up)
 *   events/{id}/registrations/{rid}
 *       .groupId       -> null
 *       .groupOwnerId  -> null
 *       .isOpenSeat    -> false
 *
 * The strict Zod converters give each of these a `.default(...)`, so a stale
 * doc still *parses*; the backfill exists so the stored data says what the
 * model means rather than relying on a default forever, and so the conformance
 * gate has something honest to check.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills".
 *
 *   node scripts/backfill-event-group-signup.mjs --env=dev            (dry run)
 *   node scripts/backfill-event-group-signup.mjs --env=dev --apply
 *   node scripts/backfill-event-group-signup.mjs --env=beta --confirm --apply
 */

import { BatchWriter, backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'event-group-signup',
  kind: 'backfill',
  description: 'Seed events.signupGroupSize=1 and registrations.groupId/groupOwnerId/isOpenSeat',
  // pre-deploy: purely additive, but the fields are what the new sign-up path
  // reads, so having them in place before the code lands keeps the two honest.
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: [],
};

function eventPatch(data) {
  return typeof data.signupGroupSize === 'number' ? null : { signupGroupSize: 1 };
}

function registrationPatch(data) {
  const patch = {};
  if (data.groupId === undefined) patch.groupId = null;
  if (data.groupOwnerId === undefined) patch.groupOwnerId = null;
  if (data.isOpenSeat === undefined) patch.isOpenSeat = false;
  return Object.keys(patch).length > 0 ? patch : null;
}

export async function run({ db, apply, log }) {
  log('events.signupGroupSize');
  const events = await backfillCollection(db, 'events', db.collection('events'), eventPatch, {
    apply,
  });

  // Registrations are a subcollection, so they are walked per event rather
  // than by collection group (which would need its own index for a one-off).
  // Written through a single BatchWriter instead of backfillCollection so the
  // run reports one line rather than one per event.
  log('events/*/registrations group fields');
  const eventsSnap = await db.collection('events').select().get();
  const writer = new BatchWriter(db, { apply });
  let regTotal = 0;
  let regPatched = 0;
  for (const eventDoc of eventsSnap.docs) {
    const regsSnap = await eventDoc.ref.collection('registrations').get();
    regTotal += regsSnap.size;
    for (const regDoc of regsSnap.docs) {
      const patch = registrationPatch(regDoc.data());
      if (!patch) continue;
      regPatched++;
      await writer.update(regDoc.ref, patch);
    }
  }
  await writer.flush();
  log(
    `  registrations: ${regTotal} docs — ${apply ? 'patched' : 'would patch'} ${regPatched}, already conformant ${regTotal - regPatched}`,
  );

  return {
    events: events.total,
    eventsPatched: events.patched,
    registrations: regTotal,
    registrationsPatched: regPatched,
  };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
