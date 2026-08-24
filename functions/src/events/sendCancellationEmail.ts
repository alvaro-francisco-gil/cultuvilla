/**
 * Builds and sends the mail that tells someone a seat of theirs is gone —
 * either because they cancelled it ('cancellation', a receipt) or because an
 * organizer or the group's owner did ('removed', news they did not ask for).
 *
 * Best-effort: see sendEventEmail, which owns the transport and swallows every
 * failure. The `registration_removed` notification is the durable record.
 */

import type { EventData } from "@cultuvilla/shared";
import { EVENT_TZ } from "@cultuvilla/shared/models";
import { formatDate } from "@cultuvilla/shared/utils";
import {
  eventWebUrl,
  type CancelledEmailAttendee,
} from "@cultuvilla/shared/email";
import { sendEventEmail } from "./eventEmail";

const handler = "sendCancellationEmail";

export interface SendCancellationEmailArgs {
  userId: string;
  eventId: string;
  event: EventData;
  attendees: CancelledEmailAttendee[];
  /** Whether the recipient did this themselves. */
  selfInflicted: boolean;
}

export async function sendCancellationEmail(
  args: SendCancellationEmailArgs,
): Promise<void> {
  const { userId, eventId, event, attendees, selfInflicted } = args;

  await sendEventEmail({
    handler,
    userId,
    eventId,
    content: {
      kind: selfInflicted ? "cancellation" : "removed",
      eventTitle: event.title,
      eventUrl: eventWebUrl(eventId, process.env["GCLOUD_PROJECT"]),
      imageURL: event.imageURL,
      // Functions run in UTC; without the explicit zone the email would print
      // the event an hour or two off the Spanish wall clock.
      dateLabel: formatDate(event.startDate, "datetime", EVENT_TZ),
      locationName: event.location.displayName,
      villageName: event.villageName,
      attendees,
    },
  });
}
