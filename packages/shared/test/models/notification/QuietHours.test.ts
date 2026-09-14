import { describe, it, expect } from 'vitest';
import { isQuietHour, resolveSendTime } from '../../../src/models/notification/QuietHours';

const at = (iso: string) => new Date(iso);

describe('isQuietHour (Europe/Madrid wall clock)', () => {
  it.each([
    ['2026-07-15T19:59:00Z', false], // 21:59 CEST
    ['2026-07-15T20:00:00Z', true], // 22:00 CEST
    ['2026-07-15T05:59:00Z', true], // 07:59 CEST
    ['2026-07-15T06:00:00Z', false], // 08:00 CEST
    ['2026-01-15T21:00:00Z', true], // 22:00 CET
    ['2026-01-15T06:59:00Z', true], // 07:59 CET
    ['2026-01-15T07:00:00Z', false], // 08:00 CET
  ])('%s → %s', (iso, quiet) => {
    expect(isQuietHour(at(iso))).toBe(quiet);
  });
});

describe('resolveSendTime', () => {
  it('never holds the user’s own seat news', () => {
    const now = at('2026-07-15T01:00:00Z'); // 03:00 Madrid
    expect(resolveSendTime({ category: 'mine', quietHoursEnabled: true, now })).toEqual(now);
  });

  it('sends immediately when the user turned quiet hours off', () => {
    const now = at('2026-07-15T01:00:00Z');
    expect(resolveSendTime({ category: 'village', quietHoursEnabled: false, now })).toEqual(now);
  });

  it('sends immediately in the daytime', () => {
    const now = at('2026-07-15T10:00:00Z');
    expect(resolveSendTime({ category: 'village', quietHoursEnabled: true, now })).toEqual(now);
  });

  it('holds a late-evening broadcast until 08:00 the next morning (summer, UTC+2)', () => {
    const now = at('2026-07-15T21:30:00Z'); // 23:30 CEST
    expect(resolveSendTime({ category: 'village', quietHoursEnabled: true, now })).toEqual(
      at('2026-07-16T06:00:00Z'),
    );
  });

  it('holds an early-morning broadcast until 08:00 the same morning', () => {
    const now = at('2026-07-15T01:00:00Z'); // 03:00 CEST
    expect(resolveSendTime({ category: 'social', quietHoursEnabled: true, now })).toEqual(
      at('2026-07-15T06:00:00Z'),
    );
  });

  it('uses the winter offset (UTC+1)', () => {
    const now = at('2026-01-15T22:00:00Z'); // 23:00 CET
    expect(resolveSendTime({ category: 'village', quietHoursEnabled: true, now })).toEqual(
      at('2026-01-16T07:00:00Z'),
    );
  });

  it('lands on 08:00 local across the spring-forward night', () => {
    // 23:30 CET on 28 March; clocks jump to CEST at 02:00 on the 29th.
    const now = at('2026-03-28T22:30:00Z');
    expect(resolveSendTime({ category: 'village', quietHoursEnabled: true, now })).toEqual(
      at('2026-03-29T06:00:00Z'),
    );
  });

  it('lands on 08:00 local across the fall-back night', () => {
    // 23:30 CEST on 24 October; clocks fall back to CET at 03:00 on the 25th.
    const now = at('2026-10-24T21:30:00Z');
    expect(resolveSendTime({ category: 'village', quietHoursEnabled: true, now })).toEqual(
      at('2026-10-25T07:00:00Z'),
    );
  });

  it('rolls over month and year boundaries', () => {
    const now = at('2026-12-31T22:30:00Z'); // 23:30 CET, New Year's Eve
    expect(resolveSendTime({ category: 'village', quietHoursEnabled: true, now })).toEqual(
      at('2027-01-01T07:00:00Z'),
    );
  });
});
