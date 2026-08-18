#!/usr/bin/env node
/**
 * One-off retroactive send of the event-registration email to everyone who
 * signed up BEFORE that email existed — limited to events that have not
 * finished yet, so nobody gets mail about something already over.
 *
 * The live path (registerToEvent / waitlist promotion) only mails people who
 * sign up from now on. This walks the existing registrations of every
 * still-open published event, groups them per user per event (one mail listing
 * all the personas that user registered, exactly like the live email), and
 * sends the same template with `kind: 'existing_registration'` — framed as a
 * reminder rather than a confirmation, because "Inscripción confirmada" weeks
 * after the fact reads as a duplicate.
 *
 * EMAILS CANNOT BE UNSENT. Two guards therefore matter more than usual:
 *   - dry run is the default and prints every (event, recipient) it would mail;
 *   - each successful send writes `_admin/emailSends/{id}/{eventId}__{userId}`,
 *     and a doc that already exists is skipped. A re-run after a crash
 *     resumes; it never mails the same person twice.
 *
 * Registered on the backfill harness (see AGENTS.md "Backfills") because that
 * is the only credentialed front door to beta/prod: Actions → "Run Backfill".
 *
 *   node scripts/backfill-existing-signup-emails.mjs --env=dev            (dry run)
 *   node scripts/backfill-existing-signup-emails.mjs --env=dev --apply
 *   node scripts/backfill-existing-signup-emails.mjs --env=prod --confirm --apply
 */

import admin from 'firebase-admin';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';
import { EVENT_TZ } from '@cultuvilla/shared/models';
import { formatDate } from '@cultuvilla/shared/utils';
import {
  eventWebUrl,
  registrationEmailSubject,
  renderRegistrationEmailHtml,
  renderRegistrationEmailText,
} from '@cultuvilla/shared/email';

export const meta = {
  id: 'existing-signup-emails',
  kind: 'migration',
  description:
    'Send the registration email to people already signed up to events that have not finished yet',
  // Sends mail; it neither adds nor drops a schema field, so it gates no deploy.
  phase: 'none',
  envs: ['dev', 'beta', 'prod'],
  // Idempotent by marker doc, not by nature — see _admin/emailSends above.
  idempotent: true,
  owner: 'alvaro',
  // Never unattended: a deploy must not be able to trigger a mail blast.
  autoApply: [],
};

const FROM = 'Cultuvilla <hola@acceso.cultuvilla.es>';
const REPLY_TO = 'cultuvilla.app@gmail.com';

/**
 * Resend's default limit is 2 requests/second; one send every 600 ms stays
 * under it without needing retry bookkeeping for 429s.
 */
const SEND_INTERVAL_MS = 600;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The key lives in Secret Manager (the same secret the Cloud Functions bind as
 * RESEND_API_KEY), so there is one source of truth and no copy in CI. Reached
 * over REST with the ADC token the harness already holds, which keeps this
 * script dependency-free. `RESEND_API_KEY` in the environment wins when set,
 * for local runs against dev.
 */
async function resolveResendKey(projectId) {
  const fromEnv = process.env.RESEND_API_KEY;
  if (fromEnv) return fromEnv.trim();

  const { access_token: token } = await admin.app().options.credential.getAccessToken();
  const url = `https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/RESEND_API_KEY/versions/latest:access`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(
      `Could not read RESEND_API_KEY from Secret Manager (${String(res.status)}): ${await res.text()}. ` +
        'Grant the runner roles/secretmanager.secretAccessor on the secret, or pass RESEND_API_KEY in the environment.',
    );
  }
  const body = await res.json();
  return Buffer.from(body.payload.data, 'base64').toString('utf8').trim();
}

async function sendEmail(apiKey, { to, subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, reply_to: REPLY_TO, subject, html, text }),
  });
  if (!res.ok) throw new Error(`resend ${String(res.status)}: ${await res.text()}`);
}

/** Timestamp | Date | null → Date | null. Raw reads, so no converter to lean on. */
function toDate(value) {
  if (!value) return null;
  return typeof value.toDate === 'function' ? value.toDate() : value;
}

/**
 * Published events whose end boundary is still in the future. `endBoundary` is
 * the single field the range filter needs, so this rides the automatic
 * single-field index; `status` is filtered in memory to avoid requiring a new
 * composite index for a one-off script.
 */
async function openEvents(db) {
  const snap = await db.collection('events').where('endBoundary', '>', new Date()).get();
  return snap.docs.filter((doc) => doc.data().status === 'published');
}

/** One entry per user with at least one registration, carrying their personas. */
function groupByUser(registrationDocs) {
  const byUser = new Map();
  for (const doc of registrationDocs) {
    const reg = doc.data();
    // Walk-ins are recorded without a user account and have no inbox.
    if (typeof reg.userId !== 'string' || reg.userId === '') continue;
    const attendees = byUser.get(reg.userId) ?? [];
    attendees.push({
      name: typeof reg.name === 'string' ? reg.name : 'Invitado',
      status: reg.status === 'waitlisted' ? 'waitlisted' : 'confirmed',
      position: typeof reg.position === 'number' ? reg.position : 1,
    });
    byUser.set(reg.userId, attendees);
  }
  return byUser;
}

export async function run({ db, projectId, apply, log }) {
  const events = await openEvents(db);
  log(`${String(events.length)} published events have not finished yet`);

  const apiKey = apply ? await resolveResendKey(projectId) : null;
  const markers = db.collection('_admin').doc('emailSends').collection(meta.id);

  const counts = { events: events.length, recipients: 0, sent: 0, alreadySent: 0, noEmail: 0 };

  for (const eventDoc of events) {
    const event = eventDoc.data();
    const startDate = toDate(event.startDate);
    if (!startDate) {
      log(`skip ${eventDoc.id}: no startDate`);
      continue;
    }

    const regsSnap = await eventDoc.ref.collection('registrations').get();
    const byUser = groupByUser(regsSnap.docs);
    if (byUser.size === 0) continue;

    for (const [userId, attendees] of byUser) {
      counts.recipients++;
      const markerRef = markers.doc(`${eventDoc.id}__${userId}`);
      if ((await markerRef.get()).exists) {
        counts.alreadySent++;
        continue;
      }

      const userSnap = await db.collection('users').doc(userId).get();
      const email = userSnap.data()?.email;
      if (typeof email !== 'string' || email.trim() === '') {
        counts.noEmail++;
        log(`skip ${eventDoc.id}/${userId}: no email on file`);
        continue;
      }

      const content = {
        kind: 'existing_registration',
        eventTitle: event.title,
        eventUrl: eventWebUrl(eventDoc.id, projectId),
        imageURL: event.imageURL ?? null,
        // Scripts run in whatever zone the runner has; the explicit zone keeps
        // the mail on the Spanish wall clock, as the Cloud Function does.
        dateLabel: formatDate(startDate, 'datetime', EVENT_TZ),
        locationName: event.location?.displayName ?? '',
        villageName: event.villageName ?? '',
        attendees,
        confirmedCount:
          typeof event.confirmedCount === 'number'
            ? event.confirmedCount
            : attendees.filter((a) => a.status === 'confirmed').length,
        maxAttendees: typeof event.maxAttendees === 'number' ? event.maxAttendees : null,
      };

      if (!apply) {
        log(`would mail ${email.trim()} — ${event.title} (${String(attendees.length)} personas)`);
        continue;
      }

      await sendEmail(apiKey, {
        to: email.trim(),
        subject: registrationEmailSubject(content),
        html: renderRegistrationEmailHtml(content),
        text: renderRegistrationEmailText(content),
      });
      // Written per send, not batched: a crash mid-run must leave every mail
      // that did go out marked, or the resume mails those people again.
      await markerRef.set({
        eventId: eventDoc.id,
        userId,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      counts.sent++;
      log(`mailed ${email.trim()} — ${event.title}`);
      await sleep(SEND_INTERVAL_MS);
    }
  }

  log(
    `recipients ${String(counts.recipients)} · ${apply ? 'sent' : 'would send'} ${String(
      apply ? counts.sent : counts.recipients - counts.alreadySent - counts.noEmail,
    )} · already sent ${String(counts.alreadySent)} · no email ${String(counts.noEmail)}`,
  );
  return counts;
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
