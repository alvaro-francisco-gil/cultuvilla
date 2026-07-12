import { describe, expect, it } from 'vitest';
import { buildGoogleCalendarUrl } from '../../src/utils/calendar';

describe('buildGoogleCalendarUrl', () => {
  const start = new Date('2026-07-12T16:00:00.000Z');
  const end = new Date('2026-07-12T20:00:00.000Z');

  it('points at the Google Calendar TEMPLATE endpoint', () => {
    const url = buildGoogleCalendarUrl({ title: 'Fiesta', start });
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
    expect(url).toContain('action=TEMPLATE');
  });

  it('encodes start and end as compact UTC timestamps', () => {
    const url = buildGoogleCalendarUrl({ title: 'Fiesta', start, end });
    expect(url).toContain('dates=20260712T160000Z%2F20260712T200000Z');
  });

  it('defaults to a 2h duration when no end is given', () => {
    const url = buildGoogleCalendarUrl({ title: 'Fiesta', start });
    expect(url).toContain('dates=20260712T160000Z%2F20260712T180000Z');
  });

  it('treats a null end like a missing one', () => {
    const url = buildGoogleCalendarUrl({ title: 'Fiesta', start, end: null });
    expect(url).toContain('dates=20260712T160000Z%2F20260712T180000Z');
  });

  it('url-encodes the title', () => {
    const url = buildGoogleCalendarUrl({ title: 'Fiesta de San Juan', start });
    expect(url).toContain('text=Fiesta+de+San+Juan');
  });

  it('includes details and location only when provided', () => {
    const withExtras = buildGoogleCalendarUrl({
      title: 'Fiesta',
      start,
      details: 'Trae tu propia bebida',
      location: 'Plaza Mayor',
    });
    expect(withExtras).toContain('details=Trae');
    expect(withExtras).toContain('location=Plaza+Mayor');

    const without = buildGoogleCalendarUrl({ title: 'Fiesta', start });
    expect(without).not.toContain('details=');
    expect(without).not.toContain('location=');
  });
});
