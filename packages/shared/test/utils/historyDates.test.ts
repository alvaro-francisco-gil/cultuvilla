import { describe, it, expect } from 'vitest';
import {
  formatHistoricalDate,
  formatHistoryEntryDate,
  historicalCentury,
  historicalCenturyLabel,
} from '../../src/utils/historyDates';

const y = (year: number) => ({ year, month: null, day: null });

describe('formatHistoricalDate', () => {
  it('prints only the precision that is known', () => {
    expect(formatHistoricalDate(y(1212))).toBe('1212');
    expect(formatHistoricalDate({ year: 1936, month: 3, day: null })).toBe('marzo de 1936');
    expect(formatHistoricalDate({ year: 1902, month: 8, day: 14 })).toBe('14 de agosto de 1902');
  });

  it('writes years before Christ as "a. C."', () => {
    expect(formatHistoricalDate(y(-218))).toBe('218 a. C.');
  });

  it('does not map a two-digit year onto the 1900s', () => {
    expect(formatHistoricalDate({ year: 74, month: 5, day: 1 })).toBe('1 de mayo de 74');
  });
});

describe('formatHistoryEntryDate', () => {
  it('formats a point in time', () => {
    expect(formatHistoryEntryDate({ start: y(1212), end: null, approximate: false })).toBe('1212');
  });

  it('formats a range with an en dash', () => {
    expect(formatHistoryEntryDate({ start: y(1936), end: y(1939), approximate: false })).toBe('1936 – 1939');
  });

  it('marks an estimate with "h."', () => {
    expect(formatHistoryEntryDate({ start: y(1500), end: null, approximate: true })).toBe('h. 1500');
    expect(formatHistoryEntryDate({ start: y(1101), end: y(1200), approximate: true })).toBe(
      'h. 1101 – 1200',
    );
  });
});

describe('historicalCentury', () => {
  it('counts centuries the way historians do — 1900 is still the 19th', () => {
    expect(historicalCentury(1900)).toBe(19);
    expect(historicalCentury(1901)).toBe(20);
    expect(historicalCentury(2026)).toBe(21);
    expect(historicalCentury(1)).toBe(1);
  });

  it('gives BC years a negative century', () => {
    expect(historicalCentury(-218)).toBe(-3);
    expect(historicalCentury(-1)).toBe(-1);
  });
});

describe('historicalCenturyLabel', () => {
  it('uses roman numerals', () => {
    expect(historicalCenturyLabel(20)).toBe('Siglo XX');
    expect(historicalCenturyLabel(12)).toBe('Siglo XII');
    expect(historicalCenturyLabel(-3)).toBe('Siglo III a. C.');
  });
});
