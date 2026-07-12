import { formatDate } from './format';
import type { DatePrecision } from '../models/festivalPoster/FestivalPosterDataModel';

/**
 * Secondary date line for a festival-poster card. Returns `null` for `year`
 * precision so the card shows only the big year with no redundant line.
 */
export function formatFestivalPosterDates(input: {
  year: number;
  datePrecision: DatePrecision;
  startsAt: Date | null;
  endsAt: Date | null;
}): string | null {
  if (input.datePrecision === 'year' || !input.startsAt) return null;
  if (input.datePrecision === 'month') return formatDate(input.startsAt, 'monthYear');
  const start = formatDate(input.startsAt, 'dayMonth');
  if (input.endsAt && input.endsAt.getTime() !== input.startsAt.getTime()) {
    return `${start} – ${formatDate(input.endsAt, 'dayMonth')} ${String(input.year)}`;
  }
  return `${start} ${String(input.year)}`;
}
