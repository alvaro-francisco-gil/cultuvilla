import { madridMonth, madridYear, type FiestaBlock } from '@cultuvilla/shared/models';

/**
 * The year whose Wrapped a village's admins should be reminded to create right
 * now, or null.
 *
 * A fiesta block only knows its month, so "the fiestas are over" is read at
 * month grain: the reminder is due during the month right after the month of
 * the year's LAST block — September for Matabuena, whose last fiestas are in
 * August. One month, not "any time after", so a village that adds its fiestas
 * in November is not nagged about a summer it never meant to summarise.
 *
 * A December block rolls over: its reminder falls in January, for the year
 * that just ended.
 */
export function wrappedReminderYear(fiestas: FiestaBlock[], now: Date): number | null {
  if (fiestas.length === 0) return null;
  const lastMonth = Math.max(...fiestas.map((b) => b.month));
  const month = madridMonth(now);
  const year = madridYear(now);
  if (lastMonth === 12) return month === 1 ? year - 1 : null;
  return month === lastMonth + 1 ? year : null;
}
