import {
  eventEndBoundary,
  isStartDayOver,
  type EventData,
} from '@cultuvilla/shared/models/event/EventDataModel';

/** The only fields the split needs — any event-shaped row qualifies. */
export type TimedEvent = Pick<EventData, 'startDate' | 'endDate'>;

export type SplitEvents<T> = {
  /** Soonest first: the next thing the viewer is signed up for sits on top. */
  upcoming: T[];
  /** Most recent first, so the top row is again the one nearest to today. */
  past: T[];
};

/**
 * Split registered events into upcoming and past.
 *
 * "Past" keys off the same day boundary the feed and the completeExpiredEvents
 * scheduler use (`eventEndBoundary` + `isStartDayOver`), so an event running
 * today — or one that started this morning — stays under "upcoming" instead of
 * disappearing from the tab the viewer is about to attend.
 */
export function splitEventsByTime<T extends TimedEvent>(
  events: readonly T[],
  now: Date,
): SplitEvents<T> {
  const upcoming: T[] = [];
  const past: T[] = [];

  for (const event of events) {
    if (isStartDayOver(eventEndBoundary(event), now)) past.push(event);
    else upcoming.push(event);
  }

  upcoming.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  past.sort((a, b) => eventEndBoundary(b).getTime() - eventEndBoundary(a).getTime());

  return { upcoming, past };
}
