import { describe, expect, it } from 'vitest';
import { formatPartialDate } from '../../src/utils/format';

describe('formatPartialDate', () => {
  it('formats year-only, month-year, and full partial dates', () => {
    expect(formatPartialDate({ year: 2020, month: null, day: null })).toBe('2020');
    expect(formatPartialDate({ year: 2020, month: 5, day: null })).toBe('Mayo 2020');
    expect(formatPartialDate({ year: 2020, month: 5, day: 3 })).toBe('03/05/2020');
  });

  it('returns null for an unknown date', () => {
    expect(formatPartialDate(null)).toBeNull();
    expect(formatPartialDate({ year: null, month: null, day: null })).toBeNull();
  });
});
