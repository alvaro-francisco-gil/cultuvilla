// packages/shared/src/models/event/RegistrationEventDataModel.ts
import { z } from 'zod';
import { RegistrationStatusSchema } from './RegistrationDataModel';

/**
 * Every way the roster's membership can change. Deliberately excludes the ops
 * toggles (`checkedInAt`, `paidAt`): those are already visible as state on the
 * row, get flipped repeatedly, and would drown the log they share.
 */
export const RegistrationEventActionSchema = z.enum([
  'signed_up',
  'walk_in_added',
  'seat_claimed',
  'waitlist_promoted',
  'cancelled_self',
  'removed_by_organizer',
  'group_cancelled',
  'seat_released',
  // The organizer turned in-app sign-ups off, and `onEventUpdated` swept the
  // whole roster. Its own action rather than `removed_by_organizer` because
  // nobody decided it per attendee — and it is the one removal an organizer is
  // most likely to be asked to account for afterwards.
  'signups_disabled',
]);
export type RegistrationEventAction = z.infer<typeof RegistrationEventActionSchema>;

/**
 * Append-only audit record of one change to an event's roster, stored at
 * `events/{eventId}/registrationEvents/{id}`.
 *
 * It exists because cancellation is a hard delete: `cancelRegistration` removes
 * the registration doc outright, so without this log an organizer has no way to
 * see that someone signed up and then left, or that a co-organizer removed
 * them. The roster answers "who is coming"; this answers "what happened".
 *
 * A subcollection rather than a top-level collection (cf. `membershipEvents`)
 * because the audience is exactly `isEventOrganizer(eventId)` — binding the
 * event from the path lets that rule's `get()` be paid once per query instead
 * of once per row.
 *
 * Written ONLY by Cloud Functions (admin SDK), in the same transaction as the
 * mutation it records; `firestore.rules` denies every client write, which is
 * why there is no client-write shape predicate for this collection.
 *
 * The log is organizer-only, so it carries the real `name` even for a person
 * marked private — the same trade `registrationPrivate` already makes.
 */
export const RegistrationEventDataSchema = z.object({
  // The registration the change happened to. NOT a live reference — the doc it
  // names is usually gone by the time anyone reads this.
  registrationId: z.string(),
  action: RegistrationEventActionSchema,
  // Who performed the change: the attendee themselves, an organizer, a village
  // admin, or the group owner. Equals `subjectUserId` on a self-service action.
  actorUserId: z.string(),
  // The uid the registration was held by. For a seat claimed through an invite
  // link this is the claimer, not the group owner — same as `registrations.userId`.
  subjectUserId: z.string(),
  // Point-in-time copies, so the entry still reads after the person doc or the
  // registration is gone. An open seat has no person: `personId` is ''.
  personId: z.string(),
  name: z.string(),
  // The registration's status at the moment of the change — for
  // `waitlist_promoted`, the status it was promoted TO. Distinguishes removing
  // a confirmed attendee from dropping someone off the waitlist.
  status: RegistrationStatusSchema,
  // The group the seat belonged to, or null for an individual registration.
  groupId: z.string().nullable(),
  at: z.date(),
});
export type RegistrationEventData = z.infer<typeof RegistrationEventDataSchema>;

export interface RegistrationEventDataInput {
  registrationId: string;
  action: RegistrationEventAction;
  actorUserId: string;
  subjectUserId: string;
  personId: string;
  name: string;
  status: z.infer<typeof RegistrationStatusSchema>;
  groupId?: string | null;
  at?: Date;
}

export function buildRegistrationEventData(
  input: RegistrationEventDataInput,
): RegistrationEventData {
  return {
    registrationId: input.registrationId,
    action: input.action,
    actorUserId: input.actorUserId,
    subjectUserId: input.subjectUserId,
    personId: input.personId,
    name: input.name,
    status: input.status,
    groupId: input.groupId ?? null,
    at: input.at ?? new Date(),
  };
}
