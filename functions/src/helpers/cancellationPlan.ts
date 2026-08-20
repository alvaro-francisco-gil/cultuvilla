/**
 * Pure decision for "what does cancelling this registration actually do".
 *
 * Group sign-ups make this more than a delete. A group is atomic, so removing
 * one of its seats has to either take the whole group with it or leave the
 * group intact at full size — never shrink it, which would leave a pareja
 * event holding a lone attendee.
 */

export interface CancellationSubject {
  /** Who holds the seat now (the claimer, once a seat has been claimed). */
  userId: string;
  groupId: string | null;
  /** Who booked the group and stays accountable for its open seats. */
  groupOwnerId: string | null;
}

export type CancellationPlan =
  /** Ordinary individual registration: just remove it. */
  | { action: 'delete-solo' }
  /** The group is pulling out; every seat in it goes. */
  | { action: 'delete-group'; groupId: string }
  /** One guest is dropping out; their seat reverts to an open, claimable one. */
  | { action: 'release-seat'; groupId: string };

export interface CancellationContext {
  uid: string;
  /** Named organizer, village admin, or app admin for this event. */
  isOrganizer: boolean;
  registration: CancellationSubject;
}

/**
 * Returns the plan, or `null` when the caller may not cancel this at all.
 *
 * An organizer removing someone takes the whole group: on an event that
 * requires groups, leaving a half-group behind would be a state the sign-up
 * path itself refuses to create.
 */
export function resolveCancellation(ctx: CancellationContext): CancellationPlan | null {
  const { uid, isOrganizer, registration } = ctx;

  const isHolder = registration.userId === uid;
  if (!isOrganizer && !isHolder) return null;

  if (registration.groupId === null) return { action: 'delete-solo' };
  const groupId = registration.groupId;

  if (isOrganizer) return { action: 'delete-group', groupId };
  // The owner leaving dissolves the group — including any seat a guest had
  // already claimed, since the group cannot continue below its required size.
  if (registration.groupOwnerId === uid) return { action: 'delete-group', groupId };

  // A guest who claimed a seat gives it back rather than collapsing someone
  // else's group. The owner is notified and can re-share the new link.
  return { action: 'release-seat', groupId };
}
