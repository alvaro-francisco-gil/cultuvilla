import { describe, it, expect } from 'vitest';
import { wrappedReminderYear } from '../../wrapped/wrappedWindows';

const santiago = { id: 'santiago', name: 'Santiago', month: 7 };
const carmen = { id: 'carmen', name: 'Carmen', month: 8 };
const nochebuena = { id: 'nochebuena', name: 'Nochebuena', month: 12 };

describe('wrappedReminderYear', () => {
  it('is due the month after the last fiestas of the year', () => {
    expect(wrappedReminderYear([santiago, carmen], new Date('2026-09-01T08:00:00+02:00'))).toBe(2026);
    expect(wrappedReminderYear([santiago, carmen], new Date('2026-09-30T20:00:00+02:00'))).toBe(2026);
  });

  // Santiago in July is over by August, but the Carmen is still to come.
  it('waits for the last block, not the first', () => {
    expect(wrappedReminderYear([santiago, carmen], new Date('2026-08-10T12:00:00+02:00'))).toBeNull();
  });

  it('is not due during the fiestas month or long after it', () => {
    expect(wrappedReminderYear([carmen], new Date('2026-08-31T23:00:00+02:00'))).toBeNull();
    expect(wrappedReminderYear([carmen], new Date('2026-10-01T09:00:00+02:00'))).toBeNull();
  });

  // 22:30 UTC on 31 August is already 1 September in Madrid.
  it('reads the month in Madrid', () => {
    expect(wrappedReminderYear([carmen], new Date('2026-08-31T22:30:00Z'))).toBe(2026);
  });

  it('rolls a December block into January, for the year that ended', () => {
    expect(wrappedReminderYear([carmen, nochebuena], new Date('2027-01-05T10:00:00+01:00'))).toBe(2026);
    expect(wrappedReminderYear([carmen, nochebuena], new Date('2026-09-05T10:00:00+02:00'))).toBeNull();
  });

  it('is never due for a village without fiestas', () => {
    expect(wrappedReminderYear([], new Date('2026-09-01T08:00:00+02:00'))).toBeNull();
  });
});
