import { z } from 'zod';
import { EVENT_TZ } from '../event/EventDataModel';

/**
 * When a village's fiestas are. A village declares one block per distinct
 * celebration — Matabuena has two (Santiago in July, the Carmen in August),
 * with ordinary weeks between them, which is why this is a list.
 *
 * A block is a NAME and a MONTH, nothing more. The exact days move every year
 * (a block that tracks a weekend) and nobody keeps a calendar pattern up to
 * date, so the profile holds only what is true every year. The exact dates of
 * one year are chosen when that year's Wrapped is created, and are stored on
 * the Wrapped they describe — see `WrappedDataModel`.
 */

export const FiestaBlockSchema = z.object({
  /** Stable across renames. */
  id: z.string().min(1),
  name: z.string().min(1),
  month: z.number().int().min(1).max(12),
});
export type FiestaBlock = z.infer<typeof FiestaBlockSchema>;

export function buildFiestaBlock(input: FiestaBlock): FiestaBlock {
  return { id: input.id, name: input.name, month: input.month };
}

/**
 * A stable, unique, human-readable id for a new block, generated once from the
 * name and then left alone so a rename never changes it.
 */
export function fiestaBlockId(name: string, existingIds: string[]): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'fiesta';
  if (!existingIds.includes(base)) return base;
  let n = 2;
  while (existingIds.includes(`${base}-${String(n)}`)) n++;
  return `${base}-${String(n)}`;
}

/**
 * Milliseconds Europe/Madrid is ahead of UTC at `at` — +1h in winter, +2h in
 * summer. Derived from the zone database rather than hardcoded, so it stays
 * right if Spain ever abolishes DST.
 */
function madridOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_TZ,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asUtc - at.getTime();
}

/** The instant that is midnight in Madrid on the given calendar day. */
function madridMidnight(year: number, month: number, day: number): Date {
  const guess = Date.UTC(year, month - 1, day);
  return new Date(guess - madridOffsetMs(new Date(guess)));
}

/** A Madrid calendar day as `YYYY-MM-DD` — how a picked day crosses the wire. */
export const DayKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((key) => {
    const [y, m, d] = key.split('-').map(Number);
    const probe = new Date(Date.UTC(y, m - 1, d));
    return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
  }, 'not a calendar day');
export type DayKey = z.infer<typeof DayKeySchema>;

/**
 * The instants spanning whole Madrid calendar days, first to last inclusive.
 *
 * Days, not instants, are what an admin picks, and they are resolved here — on
 * one side of the wire — so a phone in another time zone can never shift a
 * fiesta by a day. The end is the last instant of the final day: Madrid
 * midnight of the day after, less a millisecond, recomputed in calendar space
 * so a DST change inside the range cannot cut it an hour short.
 */
export function madridDayRange(startDay: DayKey, endDay: DayKey): { start: Date; end: Date } {
  const [sy, sm, sd] = startDay.split('-').map(Number);
  const [ey, em, ed] = endDay.split('-').map(Number);
  const after = new Date(Date.UTC(ey, em - 1, ed + 1));
  return {
    start: madridMidnight(sy, sm, sd),
    end: new Date(madridMidnight(after.getUTCFullYear(), after.getUTCMonth() + 1, after.getUTCDate()).getTime() - 1),
  };
}

/**
 * The Madrid calendar year an instant falls in.
 *
 * Instants are stored in UTC, so `getFullYear()` is wrong at the edges:
 * midnight on 1 January in Madrid is 23:00 on 31 December UTC.
 */
export function madridYear(at: Date): number {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: EVENT_TZ, year: 'numeric' }).format(at));
}

/** The Madrid calendar month (1–12) an instant falls in. */
export function madridMonth(at: Date): number {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: EVENT_TZ, month: 'numeric' }).format(at));
}
