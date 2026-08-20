// packages/shared/src/models/event/RegistrationRibbonModel.ts
import type { RegistrationStatus } from './RegistrationDataModel';

/**
 * How many of the viewer's registrations (their own plus their personas') sit
 * in each status on one event. Both zero means the viewer has no stake in it.
 */
export interface RegistrationTally {
  confirmed: number;
  waitlisted: number;
}

/**
 * The marker an event card shows for the viewer's own registrations. `count`
 * is the number of people, so `1` renders the singular label and anything
 * higher renders the plural with the number.
 *
 * `mixed` carries both counts because each one is bound to its own half of the
 * ribbon — collapsing them to a total would leave the reader unable to tell
 * whether a family of three is in or queued.
 */
export type RegistrationRibbon =
  | { kind: 'confirmed'; count: number }
  | { kind: 'waitlisted'; count: number }
  | { kind: 'mixed'; confirmed: number; waitlisted: number };

/**
 * Picks the ribbon for one event, or `null` when the viewer has no
 * registrations on it (the overwhelmingly common case in a feed).
 *
 * Deliberately blind to *whose* registrations these are: signing up two
 * children without yourself reads as "Apuntados ×2", the same as signing up
 * yourself and one child. The detail screen is where you see who is on the
 * list; the card only answers "does this event involve my household".
 */
export function resolveRegistrationRibbon(tally: RegistrationTally): RegistrationRibbon | null {
  const confirmed = Math.max(0, Math.trunc(tally.confirmed));
  const waitlisted = Math.max(0, Math.trunc(tally.waitlisted));
  if (confirmed > 0 && waitlisted > 0) return { kind: 'mixed', confirmed, waitlisted };
  if (confirmed > 0) return { kind: 'confirmed', count: confirmed };
  if (waitlisted > 0) return { kind: 'waitlisted', count: waitlisted };
  return null;
}

/**
 * Reduces a flat list of the viewer's registrations into one tally per event.
 * The caller supplies rows already scoped to a single user — this does no
 * filtering of its own.
 */
export function tallyRegistrationsByEvent(
  rows: readonly { eventId: string; status: RegistrationStatus }[],
): Map<string, RegistrationTally> {
  const byEvent = new Map<string, RegistrationTally>();
  for (const row of rows) {
    const tally = byEvent.get(row.eventId) ?? { confirmed: 0, waitlisted: 0 };
    if (row.status === 'confirmed') tally.confirmed += 1;
    else tally.waitlisted += 1;
    byEvent.set(row.eventId, tally);
  }
  return byEvent;
}
