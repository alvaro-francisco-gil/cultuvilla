#!/usr/bin/env node
/**
 * Repairs events whose in-app sign-ups were switched off while they already
 * carried registrations — the state the `signupEnabled` toggle could reach
 * before `onEventUpdated` learned to sweep the roster with it.
 *
 * Such an event tells everyone it takes no sign-ups through the app while
 * still listing the people who made one, and those people can no longer cancel
 * their own place (the cancel button lives on the sign-up FAB, which the detail
 * screen hides). This deletes each registration, its organizer-only private
 * doc and any unconsumed group-invite link, and tells every affected account
 * once — the same thing the trigger now does at the moment of the flip.
 *
 * Idempotent: an event with no registrations left is skipped, and the
 * notification id is derived from the event, so a re-run overwrites rather
 * than appends.
 *
 * The notification wording is deliberately kept in step with
 * functions/src/events/notificationTriggers.ts — a script cannot import the
 * functions' TypeScript, so the two texts are read together, not shared.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills" and
 * `pnpm backfills:list`.
 *
 *   node scripts/cleanup-signups-disabled-registrations.mjs --env=dev            (dry run)
 *   node scripts/cleanup-signups-disabled-registrations.mjs --env=dev --apply
 *   node scripts/cleanup-signups-disabled-registrations.mjs --env=prod --confirm --apply
 */

import { BatchWriter } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'signups-disabled-registration-sweep',
  kind: 'cleanup',
  description:
    'Delete the registrations left behind on events whose in-app sign-ups were turned off, and notify the people who were on them',
  // Repairs data the shipped code can already read; it gates no deploy.
  phase: 'none',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  // Never unattended: it deletes people's sign-ups.
  autoApply: [],
};

function notificationFor(eventTitle, eventId, municipalityId) {
  return {
    type: 'signups_disabled',
    title: 'Inscripción eliminada',
    body: `El organizador de "${eventTitle}" ha desactivado las inscripciones por la app. Habla con quien organiza el evento si quieres asistir.`,
    eventId,
    municipalityId,
    requesterUid: null,
    entityKind: null,
    entityId: null,
    read: false,
    createdAt: new Date(),
  };
}

export async function run({ db, apply, log }) {
  const events = await db.collection('events').where('signupEnabled', '==', false).get();
  log(`events with in-app sign-ups off: ${events.size}`);

  const writer = new BatchWriter(db, { apply });
  let affectedEvents = 0;
  let removedRegistrations = 0;
  let removedTokens = 0;
  let notifiedUsers = 0;

  for (const eventDoc of events.docs) {
    const regs = await eventDoc.ref.collection('registrations').get();
    if (regs.empty) continue;

    const tokens = await eventDoc.ref.collection('seatTokens').get();
    const event = eventDoc.data();
    const userIds = new Set(regs.docs.map((r) => r.data().userId).filter(Boolean));

    affectedEvents++;
    removedRegistrations += regs.size;
    removedTokens += tokens.size;
    notifiedUsers += userIds.size;

    log(
      `  ${eventDoc.id} "${event.title ?? ''}": ${apply ? 'removing' : 'would remove'} ${regs.size} ` +
        `registration(s), notifying ${userIds.size} account(s)`,
    );

    for (const reg of regs.docs) {
      await writer.delete(reg.ref);
      await writer.delete(eventDoc.ref.collection('registrationPrivate').doc(reg.id));
    }
    for (const token of tokens.docs) {
      await writer.delete(token.ref);
    }
    for (const userId of userIds) {
      await writer.set(
        db.collection('users').doc(userId).collection('notifications').doc(`signups_disabled_${eventDoc.id}`),
        notificationFor(event.title ?? '', eventDoc.id, event.municipalityId ?? null),
      );
    }
  }
  await writer.flush();

  log(
    `${apply ? 'removed' : 'would remove'} ${removedRegistrations} registration(s) and ${removedTokens} ` +
      `seat token(s) across ${affectedEvents} event(s); notified ${notifiedUsers} account(s)`,
  );

  return {
    events: events.size,
    affectedEvents,
    removedRegistrations,
    removedTokens,
    notifiedUsers,
  };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
