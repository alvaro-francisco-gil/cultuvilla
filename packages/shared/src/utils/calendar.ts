/**
 * Build a "add to calendar" URL. We deliberately target Google Calendar's
 * TEMPLATE render endpoint (opened via `Linking.openURL`) rather than
 * `expo-calendar`: no native module, no permission prompt, and it works on the
 * web build. The tradeoff is the event opens in Google Calendar instead of the
 * device's native calendar app.
 */

const GCAL_BASE = 'https://calendar.google.com/calendar/render';

/** Default duration when an event has no end date. */
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

export interface CalendarEventInput {
  title: string;
  start: Date;
  /** When absent, the event is treated as {@link DEFAULT_DURATION_MS} long. */
  end?: Date | null;
  details?: string | null;
  location?: string | null;
}

/**
 * Google Calendar wants UTC timestamps as `YYYYMMDDTHHMMSSZ` — the compact
 * basic-format ISO 8601 with separators stripped.
 */
function toGoogleUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildGoogleCalendarUrl(input: CalendarEventInput): string {
  const end = input.end ?? new Date(input.start.getTime() + DEFAULT_DURATION_MS);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${toGoogleUtc(input.start)}/${toGoogleUtc(end)}`,
  });
  if (input.details) params.set('details', input.details);
  if (input.location) params.set('location', input.location);
  return `${GCAL_BASE}?${params.toString()}`;
}
