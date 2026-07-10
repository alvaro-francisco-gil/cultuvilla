import { describe, it, expect } from 'vitest';
import { maxBirthdayForAge, isAtLeastYearsOld } from '../../src/utils/age';

const asOf = new Date(2026, 6, 10); // 2026-07-10

describe('maxBirthdayForAge', () => {
  it('returns the same month/day shifted back by the given years', () => {
    expect(maxBirthdayForAge(14, asOf)).toEqual(new Date(2012, 6, 10));
  });
});

describe('isAtLeastYearsOld', () => {
  it('is true when the birthday is exactly on the boundary', () => {
    expect(isAtLeastYearsOld(new Date(2012, 6, 10), 14, asOf)).toBe(true);
  });

  it('is true for someone comfortably older', () => {
    expect(isAtLeastYearsOld(new Date(2000, 0, 1), 14, asOf)).toBe(true);
  });

  it('is false one day short of the birthday (same year, later day)', () => {
    // Born 2012-07-11 → turns 14 on 2026-07-11, still 13 on 2026-07-10.
    expect(isAtLeastYearsOld(new Date(2012, 6, 11), 14, asOf)).toBe(false);
  });

  it('is false for a clearly under-age birthday', () => {
    expect(isAtLeastYearsOld(new Date(2020, 0, 1), 14, asOf)).toBe(false);
  });
});
