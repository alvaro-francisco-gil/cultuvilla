import { describe, expect, it } from '@jest/globals';
import { normalizeBolds, isRangeBold, toggleBold } from '../boldText';

describe('normalizeBolds', () => {
  it('sorts, drops empties, and merges touching/overlapping spans', () => {
    expect(
      normalizeBolds([
        { offset: 10, length: 2 },
        { offset: 0, length: 0 },
        { offset: 2, length: 3 }, // touches [0,2)? no — starts at 2, previous ends at 2 → merges
        { offset: 0, length: 2 },
      ]),
    ).toEqual([
      { offset: 0, length: 5 },
      { offset: 10, length: 2 },
    ]);
  });
});

describe('isRangeBold', () => {
  const bolds = [{ offset: 0, length: 5 }];
  it('is true when the range is fully covered', () => {
    expect(isRangeBold(bolds, 1, 4)).toBe(true);
    expect(isRangeBold(bolds, 0, 5)).toBe(true);
  });
  it('is false when part of the range is uncovered', () => {
    expect(isRangeBold(bolds, 3, 7)).toBe(false);
  });
  it('is false for a collapsed range', () => {
    expect(isRangeBold(bolds, 2, 2)).toBe(false);
  });
  it('spans a gap-free run of adjacent spans', () => {
    expect(isRangeBold([{ offset: 0, length: 3 }, { offset: 3, length: 3 }], 1, 5)).toBe(true);
  });
});

describe('toggleBold', () => {
  it('adds bold when the range is not bold', () => {
    expect(toggleBold([], 2, 6)).toEqual([{ offset: 2, length: 4 }]);
  });
  it('merges an added range into an adjacent existing span', () => {
    expect(toggleBold([{ offset: 0, length: 2 }], 2, 5)).toEqual([{ offset: 0, length: 5 }]);
  });
  it('removes bold when the range is fully bold', () => {
    expect(toggleBold([{ offset: 0, length: 6 }], 2, 4)).toEqual([
      { offset: 0, length: 2 },
      { offset: 4, length: 2 },
    ]);
  });
  it('clears exactly a fully-bold selection', () => {
    expect(toggleBold([{ offset: 0, length: 4 }], 0, 4)).toEqual([]);
  });
  it('is a no-op for a collapsed range', () => {
    expect(toggleBold([{ offset: 0, length: 4 }], 3, 3)).toEqual([{ offset: 0, length: 4 }]);
  });
});
