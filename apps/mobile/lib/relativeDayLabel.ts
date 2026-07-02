import { calendarDayOffset, formatDate } from '@cultuvilla/shared/utils';
import type { I18n } from './i18n';

/**
 * Feed-card date label: "Hoy" / "Mañana" when the date falls on today or
 * tomorrow, otherwise the short numeric date. Shared by EventCard and NewsCard
 * so both feeds read the same way.
 */
export function relativeDayLabel(date: Date, t: I18n['t']): string {
  const offset = calendarDayOffset(date);
  if (offset === 0) return t('feed.date.today');
  if (offset === 1) return t('feed.date.tomorrow');
  return formatDate(date, 'dayMonth');
}
