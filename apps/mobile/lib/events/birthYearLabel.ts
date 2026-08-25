import type { BirthYearWindow } from '@cultuvilla/shared/models/event/EventDataModel';

type Translate = (key: string, values?: Record<string, string>) => string;

/**
 * Human label for an event's advertised birth-year window, in the three shapes
 * it can take: both ends ("nacidos entre 2014 y 2020"), a floor only, or a
 * ceiling only. Returns null when the event advertises no window, so callers
 * can use it as the "should I render this at all?" test too.
 */
export function birthYearRangeLabel(window: BirthYearWindow, t: Translate): string | null {
  const { minBirthYear: min, maxBirthYear: max } = window;
  if (min === null && max === null) return null;
  if (min !== null && max !== null) {
    return min === max
      ? t('event.birthYearLabel.exact', { year: String(min) })
      : t('event.birthYearLabel.between', { min: String(min), max: String(max) });
  }
  if (min !== null) return t('event.birthYearLabel.from', { min: String(min) });
  return t('event.birthYearLabel.to', { max: String(max as number) });
}
