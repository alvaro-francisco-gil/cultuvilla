/**
 * Locale-formatted display helpers. All preset to `es-ES`. Whenever you
 * find yourself reaching for `Intl.DateTimeFormat` or
 * `Intl.NumberFormat` in a screen, write a helper here instead —
 * formatting drift across the app reads as bugs.
 */

const LOCALE = 'es-ES';

export type DateStyle = 'short' | 'dayMonth' | 'monthYear' | 'long' | 'time' | 'datetime';

export function formatDate(date: Date, style: DateStyle = 'short'): string {
  switch (style) {
    case 'short':
      return new Intl.DateTimeFormat(LOCALE, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);
    // Day + month name, no year: "2 de Julio". The month is capitalised (Intl
    // gives lowercase "julio") for the app's display style.
    case 'dayMonth': {
      const parts = new Intl.DateTimeFormat(LOCALE, {
        day: 'numeric',
        month: 'long',
      }).formatToParts(date);
      return parts
        .map((p) => (p.type === 'month' ? p.value.charAt(0).toUpperCase() + p.value.slice(1) : p.value))
        .join('');
    }
    // Month + year, no "de": "Agosto 2025". Intl's { month: 'long', year:
    // 'numeric' } inserts a literal " de " between them (es-ES grammar); we
    // drop literals and join with a single space for the poster's display style.
    case 'monthYear': {
      const parts = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' }).formatToParts(date);
      return parts
        .filter((p) => p.type !== 'literal')
        .map((p) => (p.type === 'month' ? p.value.charAt(0).toUpperCase() + p.value.slice(1) : p.value))
        .join(' ');
    }
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

/**
 * Whole-calendar-day offset of `date` from `now`: 0 = today, 1 = tomorrow,
 * -1 = yesterday. Compares calendar days (local time), not 24h spans, so a
 * time later today is still 0 and any time tomorrow is 1. Callers map the
 * result to relative labels ("Hoy"/"Mañana").
 */
export function calendarDayOffset(date: Date, now: Date = new Date()): number {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
}

/**
 * The 12 capitalized es-ES abbreviated month names ("Ene".."Dic"), derived
 * from Intl rather than hardcoded, so the locale stays the single source
 * of truth for month labels (month chip pickers, etc.).
 */
export function monthShortLabels(): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const raw = new Intl.DateTimeFormat(LOCALE, { month: 'short' }).format(new Date(2000, i, 1));
    const trimmed = raw.replace(/\.$/, '');
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  });
}

export function monthLongLabels(): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const raw = new Intl.DateTimeFormat(LOCALE, { month: 'long' }).format(new Date(2000, i, 1));
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  });
}

export function formatPrice(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    useGrouping: true,
  }).format(amount);
}

type RTFUnit =
  | 'year'
  | 'month'
  | 'week'
  | 'day'
  | 'hour'
  | 'minute'
  | 'second';

interface TimeUnit {
  unit: RTFUnit;
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

type RelativeTimeFormatter = { format: (value: number, unit: RTFUnit) => string };

let rtfCache: RelativeTimeFormatter | undefined;

const ES_UNIT_LABELS: Record<RTFUnit, [string, string]> = {
  year: ['año', 'años'],
  month: ['mes', 'meses'],
  week: ['semana', 'semanas'],
  day: ['día', 'días'],
  hour: ['hora', 'horas'],
  minute: ['minuto', 'minutos'],
  second: ['segundo', 'segundos'],
};

function fallbackRTF(): RelativeTimeFormatter {
  return {
    format(value, unit) {
      const abs = Math.abs(value);
      const [singular, plural] = ES_UNIT_LABELS[unit];
      const label = abs === 1 ? singular : plural;
      if (value === 0) return unit === 'second' ? 'ahora' : `en 0 ${label}`;
      return value < 0 ? `hace ${String(abs)} ${label}` : `en ${String(abs)} ${label}`;
    },
  };
}

function getRTF(): RelativeTimeFormatter {
  if (rtfCache) return rtfCache;
  const Ctor = (Intl as unknown as { RelativeTimeFormat?: typeof Intl.RelativeTimeFormat })
    .RelativeTimeFormat;
  rtfCache = Ctor
    ? (new Ctor(LOCALE, { numeric: 'auto' }))
    : fallbackRTF();
  return rtfCache;
}

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diff = date.getTime() - now.getTime();
  const rtf = getRTF();
  for (const { unit, ms } of UNITS) {
    if (Math.abs(diff) >= ms) {
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return rtf.format(0, 'second');
}
