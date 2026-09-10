import {
  HistoricalDateSchema,
  historicalDateSortKey,
  type HistoricalDate,
} from '@cultuvilla/shared/models/history';

/** What the date inputs hold while being edited: the year as typed, and the
 *  era as a separate toggle so a villager never has to type a minus sign. */
export interface HistoricalDateDraft {
  year: string;
  bc: boolean;
  month: number | null;
  day: string;
}

export type DateDraftError = 'yearRequired' | 'yearZero' | 'dayInvalid';

export function emptyDateDraft(): HistoricalDateDraft {
  return { year: '', bc: false, month: null, day: '' };
}

export function draftFromDate(date: HistoricalDate): HistoricalDateDraft {
  return {
    year: String(Math.abs(date.year)),
    bc: date.year < 0,
    month: date.month,
    day: date.day != null ? String(date.day) : '',
  };
}

export function parseDateDraft(
  draft: HistoricalDateDraft,
): { date: HistoricalDate } | { error: DateDraftError } {
  const yearDigits = draft.year.trim();
  if (!yearDigits) return { error: 'yearRequired' };
  const magnitude = parseInt(yearDigits, 10);
  if (!Number.isInteger(magnitude)) return { error: 'yearRequired' };
  if (magnitude === 0) return { error: 'yearZero' };
  const dayDigits = draft.day.trim();
  const date = {
    year: draft.bc ? -magnitude : magnitude,
    month: draft.month,
    // A day only means something inside a month; the day input is disabled
    // without one, but a stale value may linger after the month is cleared.
    day: draft.month != null && dayDigits ? parseInt(dayDigits, 10) : null,
  };
  const parsed = HistoricalDateSchema.safeParse(date);
  return parsed.success ? { date: parsed.data } : { error: 'dayInvalid' };
}

export type HistoryDatesError =
  | DateDraftError
  | 'endYearRequired'
  | 'endYearZero'
  | 'endDayInvalid'
  | 'endBeforeStart';

const END_ERROR: Record<DateDraftError, HistoryDatesError> = {
  yearRequired: 'endYearRequired',
  yearZero: 'endYearZero',
  dayInvalid: 'endDayInvalid',
};

export function validateHistoryDates(input: {
  start: HistoricalDateDraft;
  isRange: boolean;
  end: HistoricalDateDraft;
}): { start: HistoricalDate; end: HistoricalDate | null } | { error: HistoryDatesError } {
  const start = parseDateDraft(input.start);
  if ('error' in start) return start;
  if (!input.isRange) return { start: start.date, end: null };
  const end = parseDateDraft(input.end);
  if ('error' in end) return { error: END_ERROR[end.error] };
  if (historicalDateSortKey(end.date) <= historicalDateSortKey(start.date)) {
    return { error: 'endBeforeStart' };
  }
  return { start: start.date, end: end.date };
}
