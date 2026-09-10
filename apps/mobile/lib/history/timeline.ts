import type { HistoricalDate } from '@cultuvilla/shared/models/history';
import { historicalCentury } from '@cultuvilla/shared/utils';

export type TimelineRow<E> =
  | { type: 'century'; key: string; century: number }
  | { type: 'entry'; key: string; entry: E };

/**
 * Interleave century dividers into entries that are already sorted newest
 * first. Entries are spaced evenly rather than proportionally to time: a
 * pueblo's recorded history bunches into the last century with long silences
 * before it, and proportional spacing would be mostly empty scroll.
 */
export function buildTimelineRows<E extends { id: string; start: HistoricalDate }>(
  entries: E[],
): TimelineRow<E>[] {
  const rows: TimelineRow<E>[] = [];
  let current: number | null = null;
  for (const entry of entries) {
    const century = historicalCentury(entry.start.year);
    if (century !== current) {
      rows.push({ type: 'century', key: `century-${String(century)}`, century });
      current = century;
    }
    rows.push({ type: 'entry', key: entry.id, entry });
  }
  return rows;
}
