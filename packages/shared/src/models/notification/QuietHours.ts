import { EVENT_TZ } from '../event/EventDataModel';
import type { NotificationCategory } from './NotificationCategory';

/**
 * Overnight hold for broadcast pushes.
 *
 * A 03:00 "nuevo evento en Matabuena" is how a village app earns an uninstall;
 * a 23:00 "se ha liberado tu plaza" is the reason someone installed it. So the
 * hold is per-category, not global: `mine` always sends immediately.
 */
export const QUIET_HOURS_START = 22;
export const QUIET_HOURS_END = 8;

interface MadridParts {
  year: number;
  month: number;
  day: number;
  hour: number;
}

function madridParts(d: Date): MadridParts {
  // `h23` rather than `hour12: false`: the latter renders midnight as "24" on
  // some engines, which silently shifts the day.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

/** Milliseconds Madrid is ahead of UTC at the instant `d`. */
function madridOffsetMs(d: Date): number {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? '0');
  const asIfUtc = Date.UTC(
    get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'),
  );
  return asIfUtc - d.getTime();
}

/** The UTC instant of `hour:00` Madrid wall-clock on the given Madrid date. */
function madridWallClock(year: number, month: number, day: number, hour: number): Date {
  const naive = Date.UTC(year, month - 1, day, hour);
  // Two passes: the first guess uses the offset at the naive instant, which is
  // wrong only within an hour of a DST boundary; re-reading the offset at the
  // corrected instant settles it.
  const first = new Date(naive - madridOffsetMs(new Date(naive)));
  return new Date(naive - madridOffsetMs(first));
}

export function isQuietHour(at: Date): boolean {
  const { hour } = madridParts(at);
  return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END;
}

export interface ResolveSendTimeInput {
  category: NotificationCategory;
  quietHoursEnabled: boolean;
  now: Date;
}

/**
 * When this push should actually leave. Equal to `now` unless a broadcast
 * landed in the overnight window, in which case it is the next 08:00 Madrid.
 */
export function resolveSendTime(input: ResolveSendTimeInput): Date {
  const { category, quietHoursEnabled, now } = input;
  if (category === 'mine') return now;
  if (!quietHoursEnabled) return now;
  if (!isQuietHour(now)) return now;

  const { year, month, day, hour } = madridParts(now);
  // Before 08:00 the wait ends this morning; from 22:00 it ends tomorrow's.
  if (hour < QUIET_HOURS_END) return madridWallClock(year, month, day, QUIET_HOURS_END);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  return madridWallClock(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate(),
    QUIET_HOURS_END,
  );
}
