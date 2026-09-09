import { z } from 'zod';
import { EVENT_TZ, madridDayKey } from '../event/EventDataModel';

/**
 * When a village's fiestas are. A village declares one block per distinct
 * celebration — Matabuena has two (Santiago in July, the fiestas de agosto),
 * with ordinary weeks between them, which is why this is a list and not a
 * single range.
 *
 * Each block carries BOTH a recurring anchor and optional exact per-year
 * windows, because they answer different questions:
 *
 *   anchor  — "when are the fiestas, roughly?", for any year, with no admin
 *             action. Exact for a fixed saint's day; approximate for a block
 *             that tracks a weekend.
 *   years   — the authoritative window for a year that has been scheduled or
 *             has happened.
 *
 * Consumers that publish something (the Wrapped) must pass `exactOnly` so an
 * approximate window can never silently clip or over-include events.
 */

/** Days in `month`, counted in a leap year so 29 February is a legal anchor. */
function daysInMonth(month: number): number {
  return new Date(Date.UTC(2024, month, 0)).getUTCDate();
}

export const FiestaAnchorSchema = z
  .object({
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    /** Length of the block in calendar days, inclusive of the first. */
    days: z.number().int().min(1).max(31),
  })
  .refine((a) => a.day <= daysInMonth(a.month), {
    message: 'anchor day does not exist in that month',
    path: ['day'],
  });
export type FiestaAnchor = z.infer<typeof FiestaAnchorSchema>;

export const FiestaWindowSchema = z
  .object({ start: z.date(), end: z.date() })
  .refine((w) => w.end.getTime() >= w.start.getTime(), {
    message: 'fiesta window ends before it starts',
    path: ['end'],
  });
export type FiestaWindow = z.infer<typeof FiestaWindowSchema>;

export const FiestaBlockSchema = z.object({
  /** Stable across renames — the Wrapped doc id embeds it. */
  id: z.string().min(1),
  name: z.string().min(1),
  anchor: FiestaAnchorSchema,
  /** Keyed by year as a string, because that is how Firestore stores map keys. */
  years: z.record(z.string(), FiestaWindowSchema),
});
export type FiestaBlock = z.infer<typeof FiestaBlockSchema>;

export interface FiestaBlockInput {
  id: string;
  name: string;
  anchor: FiestaAnchor;
  years?: Record<number | string, FiestaWindow>;
}

export function buildFiestaBlock(input: FiestaBlockInput): FiestaBlock {
  const years: Record<string, FiestaWindow> = {};
  for (const [year, window] of Object.entries(input.years ?? {})) years[year] = window;
  return { id: input.id, name: input.name, anchor: input.anchor, years };
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

export interface ResolvedFiestaWindow extends FiestaWindow {
  source: 'exact' | 'anchor';
}

export function resolveFiestaWindow(
  block: FiestaBlock,
  year: number,
  options: { exactOnly?: boolean } = {},
): ResolvedFiestaWindow | null {
  // A Zod record types an index read as always-present, so a truthiness guard on
  // `block.years[key]` is rejected as an impossible condition — while `in`
  // narrowing widens the value to a partial under the mobile tsconfig. Looking
  // the entry up is the one form that types honestly in both workspaces.
  const key = String(year);
  const exact: FiestaWindow | undefined = Object.entries(block.years).find(([k]) => k === key)?.[1];
  if (exact) return { ...exact, source: 'exact' };
  if (options.exactOnly) return null;

  const { month, day, days } = block.anchor;
  const start = madridMidnight(year, month, day);
  // The block ends at the last instant of its final day: Madrid midnight of the
  // day after, less a millisecond. The day-after is stepped in pure calendar
  // space rather than off `start` — a Madrid midnight lands on the PREVIOUS UTC
  // date, so reading UTC fields back off it is a silent day short. Recomputing
  // the Madrid midnight also keeps the block right across a DST change inside it.
  const after = new Date(Date.UTC(year, month - 1, day + days));
  const end = new Date(
    madridMidnight(after.getUTCFullYear(), after.getUTCMonth() + 1, after.getUTCDate()).getTime() - 1,
  );
  return { start, end, source: 'anchor' };
}

/**
 * True once the block's final Madrid calendar day is over. Keyed off the day
 * rather than the instant so a block never ends mid-evening on its last night.
 */
export function isFiestaBlockOver(window: FiestaWindow, now: Date): boolean {
  return madridDayKey(now) > madridDayKey(window.end);
}

/** The next block that has not finished yet, searching this year then the next. */
export function nextFiestaWindow(
  blocks: FiestaBlock[],
  now: Date,
): { block: FiestaBlock; window: ResolvedFiestaWindow } | null {
  const year = Number(madridDayKey(now).slice(0, 4));
  const candidates = [];
  for (const offset of [0, 1]) {
    for (const block of blocks) {
      const window = resolveFiestaWindow(block, year + offset);
      if (window && !isFiestaBlockOver(window, now)) candidates.push({ block, window });
    }
  }
  candidates.sort((a, b) => a.window.start.getTime() - b.window.start.getTime());
  return candidates[0] ?? null;
}

/**
 * A stable, unique, human-readable id for a new block. The id keys the Wrapped
 * document, so it must survive a later rename of the block — which is exactly
 * why it is generated once from the name and then left alone.
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

/** Coerce a partially-edited anchor into one the schema accepts. */
export function clampAnchor(anchor: FiestaAnchor): FiestaAnchor {
  const month = Math.min(12, Math.max(1, Math.round(anchor.month) || 1));
  const day = Math.min(daysInMonth(month), Math.max(1, Math.round(anchor.day) || 1));
  const days = Math.min(31, Math.max(1, Math.round(anchor.days) || 1));
  return { month, day, days };
}
