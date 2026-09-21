/**
 * Month grids for the calendar view.
 *
 * The registry is sparse — a handful of dated records across a year — so a single
 * month grid would usually be empty. Instead it renders a run of consecutive
 * months starting from today's, marks only the days that carry something, and
 * lists those items beneath. Sparse then reads as "nothing due", which is the
 * true and useful answer, rather than as a broken calendar.
 */
import type { BusinessCard } from '@cultuvilla/shared/models';

export type CalendarItem = { card: BusinessCard; deadline: string };

export type CalendarDay = {
  /** ISO date, or null for the leading blanks that align the first weekday. */
  date: string | null;
  day: number | null;
  isToday: boolean;
  isPast: boolean;
  items: CalendarItem[];
};

export type CalendarMonth = {
  /** `YYYY-MM`. */
  key: string;
  year: number;
  /** 1–12. */
  month: number;
  label: string;
  /** Always a whole number of weeks, Monday-first. */
  days: CalendarDay[];
  items: CalendarItem[];
};

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const pad = (n: number): string => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number): string => `${String(y)}-${pad(m)}-${pad(d)}`;

/** Monday-first weekday index (0 = Monday), from a UTC date. */
function weekdayIndex(year: number, month: number, day: number): number {
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (jsDay + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Every dated record, newest last. A record with no deadline is not on a calendar. */
export function datedItems(cards: BusinessCard[]): CalendarItem[] {
  return cards
    .filter((card): card is BusinessCard & { deadline: string } => Boolean(card.deadline))
    .map((card) => ({ card, deadline: card.deadline }))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
}

/**
 * `count` consecutive months starting with the one containing `today`.
 * @param today ISO date, injected so the output is deterministic in tests.
 */
export function buildMonths(items: CalendarItem[], today: string, count = 3): CalendarMonth[] {
  const startYear = Number(today.slice(0, 4));
  const startMonth = Number(today.slice(5, 7));
  const months: CalendarMonth[] = [];

  for (let offset = 0; offset < count; offset += 1) {
    const raw = startMonth - 1 + offset;
    const year = startYear + Math.floor(raw / 12);
    const month = (raw % 12) + 1;
    const key = `${String(year)}-${pad(month)}`;
    const monthItems = items.filter((item) => item.deadline.startsWith(key));

    const days: CalendarDay[] = [];
    // Leading blanks so the 1st lands under its real weekday.
    for (let blank = 0; blank < weekdayIndex(year, month, 1); blank += 1) {
      days.push({ date: null, day: null, isToday: false, isPast: false, items: [] });
    }
    for (let day = 1; day <= daysInMonth(year, month); day += 1) {
      const date = iso(year, month, day);
      days.push({
        date,
        day,
        isToday: date === today,
        isPast: date < today,
        items: monthItems.filter((item) => item.deadline === date),
      });
    }
    // Trailing blanks so every month is a whole number of rows.
    while (days.length % 7 !== 0) {
      days.push({ date: null, day: null, isToday: false, isPast: false, items: [] });
    }

    months.push({ key, year, month, label: `${MONTHS[month - 1] ?? ''} ${String(year)}`, days, items: monthItems });
  }
  return months;
}

/** Dated records beyond the rendered window, so nothing is silently dropped. */
export function itemsAfterWindow(items: CalendarItem[], months: CalendarMonth[]): CalendarItem[] {
  const last = months.at(-1);
  if (!last) return items;
  const cutoff = `${last.key}-32`;
  return items.filter((item) => item.deadline > cutoff);
}

/** Dated records before the window — the ones already gone. */
export function itemsBeforeWindow(items: CalendarItem[], months: CalendarMonth[]): CalendarItem[] {
  const first = months[0];
  if (!first) return [];
  return items.filter((item) => item.deadline < `${first.key}-01`);
}
