import { monthShortLabels } from '@cultuvilla/shared/utils/format';

/**
 * Whole calendar days picked on a calendar, as `YYYY-MM-DD` keys.
 *
 * Keys rather than Dates: the calendar grid builds local-time Dates, and what
 * the admin means is a day in the pueblo, not an instant on their phone. The
 * server resolves a key to Madrid instants; nothing here reads a time zone.
 */
export interface DayRange {
  startDay: string;
  endDay: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKeyOf(d: Date): string {
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The local-time Date of a key's day, for the calendar grid. */
export function dateOfKey(key: string): Date {
  return new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
}

/**
 * The selection after a tap. A range is picked in two taps — first day, last
 * day — and a tap once both are set starts over. A second tap BEFORE the first
 * day makes it the new first day rather than a backwards range.
 */
export function nextRangeSelection(
  current: { startDay: string | null; endDay: string | null },
  tapped: string,
): { startDay: string; endDay: string | null } {
  const { startDay, endDay } = current;
  if (startDay === null || endDay !== null || tapped < startDay) return { startDay: tapped, endDay: null };
  return { startDay, endDay: tapped };
}

const MONTHS = monthShortLabels().map((m) => m.toLowerCase());

/** "24 – 26 jul", or "30 jul – 2 ago" across a month; a single day once. */
export function formatDayRange({ startDay, endDay }: DayRange): string {
  const day = (key: string) => String(Number(key.slice(8, 10)));
  const month = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1] ?? '';
  if (startDay === endDay) return `${day(startDay)} ${month(startDay)}`;
  if (month(startDay) === month(endDay)) return `${day(startDay)} – ${day(endDay)} ${month(endDay)}`;
  return `${day(startDay)} ${month(startDay)} – ${day(endDay)} ${month(endDay)}`;
}
