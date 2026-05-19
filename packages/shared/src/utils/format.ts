/**
 * Locale-formatted display helpers. All preset to `es-ES`. Whenever you
 * find yourself reaching for `Intl.DateTimeFormat` or
 * `Intl.NumberFormat` in a screen, write a helper here instead —
 * formatting drift across the app reads as bugs.
 */

const LOCALE = 'es-ES';

export type DateStyle = 'short' | 'long' | 'time' | 'datetime';

export function formatDate(date: Date, style: DateStyle = 'short'): string {
  switch (style) {
    case 'short':
      return new Intl.DateTimeFormat(LOCALE, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);
    case 'long':
      return new Intl.DateTimeFormat(LOCALE, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date);
    case 'time':
      return new Intl.DateTimeFormat(LOCALE, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    case 'datetime':
      return new Intl.DateTimeFormat(LOCALE, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
  }
}

export function formatPrice(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    useGrouping: true,
  }).format(amount);
}

const RTF = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

interface TimeUnit {
  unit: Intl.RelativeTimeFormatUnit;
  ms: number;
}

const UNITS: TimeUnit[] = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
  { unit: 'second', ms: 1000 },
];

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diff = date.getTime() - now.getTime();
  for (const { unit, ms } of UNITS) {
    if (Math.abs(diff) >= ms) {
      return RTF.format(Math.round(diff / ms), unit);
    }
  }
  return RTF.format(0, 'second');
}
