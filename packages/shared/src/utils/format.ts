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
