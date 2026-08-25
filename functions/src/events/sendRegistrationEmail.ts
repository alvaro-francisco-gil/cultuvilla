/**
 * Builds and sends the event-registration confirmation email. Shared by
 * registerToEvent (a user signs up), claimEventSeat (a guest takes a seat) and
 * onRegistrationDeleted (a waitlisted user is promoted).
 *
 * Best-effort: sendEventEmail owns the transport and swallows every failure,
 * so a bounced email can never undo the registration that produced it.
 */

import type { EventData } from '@cultuvilla/shared';
import { EVENT_TZ } from '@cultuvilla/shared/models';
import { formatDate } from '@cultuvilla/shared/utils';
import {
  eventWebUrl,
  type RegistrationEmailAttendee,
  type RegistrationEmailContent,
} from '@cultuvilla/shared/email';
import { sendEventEmail } from './eventEmail';

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
  kind: Extract<RegistrationEmailContent, { confirmedCount: number }>['kind'];
}

export async function sendRegistrationEmail(args: SendRegistrationEmailArgs): Promise<void> {
  const { userId, eventId, event, attendees, confirmedCount, kind } = args;

  await sendEventEmail({
    handler,
    userId,
    eventId,
    content: {
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
    },
  });
}
