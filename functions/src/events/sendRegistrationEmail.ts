/**
 * Sends the event-registration confirmation email. Shared by registerToEvent
 * (a user signs up) and onRegistrationDeleted (a waitlisted user is promoted).
 *
 * Best-effort by contract: a failure here must never fail the registration that
 * triggered it. Every path logs and returns instead of throwing — the user is
 * signed up whether or not the mail server cooperated, and the in-app
 * notification is the durable record.
 */

import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import { userDoc } from '@cultuvilla/shared/firebase/refs/admin';
import type { EventData } from '@cultuvilla/shared';
import { EVENT_TZ } from '@cultuvilla/shared/models';
import { formatDate } from '@cultuvilla/shared/utils';
import { Resend } from 'resend';
import { RESEND_API_KEY } from '../auth/secret';
import {
  registrationEmailSubject,
  renderRegistrationEmailHtml,
  renderRegistrationEmailText,
  type RegistrationEmailAttendee,
  type RegistrationEmailContent,
} from './registrationEmailTemplate';

const db = getFirestore();

const FROM = 'Cultuvilla <hola@acceso.cultuvilla.es>';
const REPLY_TO = 'cultuvilla.app@gmail.com';

const handler = 'sendRegistrationEmail';

export interface SendRegistrationEmailArgs {
  userId: string;
  eventId: string;
  event: EventData;
  attendees: RegistrationEmailAttendee[];
  /**
   * Post-write confirmed count. Callers pass the value they just wrote to the
   * event doc rather than re-reading it, so the email can never disagree with
   * the transaction that produced it.
   */
  confirmedCount: number;
  kind: RegistrationEmailContent['kind'];
}

/**
 * Absolute URL of the event's web route. Hosting serves the app at
 * `<projectId>.web.app` in every env (see .firebaserc), so the project the
 * function is running in picks the right host without extra config.
 */
export function eventWebUrl(eventId: string, projectId: string | undefined): string {
  return `https://${projectId ?? 'villa-events'}.web.app/event/${encodeURIComponent(eventId)}`;
}

export async function sendRegistrationEmail(args: SendRegistrationEmailArgs): Promise<void> {
  const { userId, eventId, event, attendees, confirmedCount, kind } = args;

  if (attendees.length === 0) return;

  let email: string;
  try {
    // Converter-wrapped: a nonconforming user doc throws here and is caught
    // below, costing an email rather than the registration.
    const snap = await userDoc(db, userId).get();
    const rawEmail = snap.data()?.email;
    if (typeof rawEmail !== 'string' || rawEmail.trim() === '') {
      // Walk-in registrations carry no user account, and a user doc can lag
      // behind auth. Neither is an error worth alerting on.
      logger.info('No email on file; skipping registration email', {
        handler,
        eventId,
        userId,
      });
      return;
    }
    email = rawEmail.trim();
  } catch (err) {
    logger.error('Could not load user for registration email', {
      handler,
      eventId,
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  const content: RegistrationEmailContent = {
    kind,
    eventTitle: event.title,
    eventUrl: eventWebUrl(eventId, process.env['GCLOUD_PROJECT']),
    imageURL: event.imageURL,
    // Functions run in UTC; without the explicit zone the email would print
    // the event an hour or two off the Spanish wall clock.
    dateLabel: formatDate(event.startDate, 'datetime', EVENT_TZ),
    locationName: event.location.displayName,
    villageName: event.villageName,
    attendees,
    confirmedCount,
    maxAttendees: event.maxAttendees,
  };

  try {
    const resend = new Resend(RESEND_API_KEY.value());
    // The Resend SDK resolves with { data: null, error } on API-level failures
    // rather than throwing, so an unchecked `error` would look like a success.
    const { error } = await resend.emails.send({
      from: FROM,
      to: email,
      replyTo: REPLY_TO,
      subject: registrationEmailSubject(content),
      html: renderRegistrationEmailHtml(content),
      text: renderRegistrationEmailText(content),
    });
    if (error) {
      logger.error('resend send failed', { handler, eventId, userId, error: error.message });
      return;
    }
  } catch (err) {
    logger.error('resend send failed', {
      handler,
      eventId,
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  logger.info('Registration email sent', {
    handler,
    eventId,
    userId,
    kind,
    attendeeCount: attendees.length,
  });
}
