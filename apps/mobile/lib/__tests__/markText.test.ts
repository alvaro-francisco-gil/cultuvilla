import { describe, expect, it } from '@jest/globals';
import { normalizeMarks, isRangeMarked, toggleMark } from '../markText';

describe('normalizeMarks', () => {
  it('merges touching/overlapping spans of the same type, keeps types separate', () => {
    expect(
      normalizeMarks([
        { type: 'bold', offset: 0, length: 2 },
        { type: 'bold', offset: 2, length: 3 }, // merges with the previous bold → [0,5)
        { type: 'italic', offset: 0, length: 2 },
      ]),
    ).toEqual([
      { type: 'bold', offset: 0, length: 5 },
      { type: 'italic', offset: 0, length: 2 },
    ]);
  });
});

describe('isRangeMarked', () => {
  const marks = [
    { type: 'bold' as const, offset: 0, length: 5 },
    { type: 'italic' as const, offset: 3, length: 4 },
  ];
  it('checks coverage per type', () => {
    expect(isRangeMarked(marks, 'bold', 1, 4)).toBe(true);
    expect(isRangeMarked(marks, 'bold', 3, 7)).toBe(false);
    expect(isRangeMarked(marks, 'italic', 3, 7)).toBe(true);
    expect(isRangeMarked(marks, 'underline', 0, 1)).toBe(false);
  });
});

describe('toggleMark', () => {
  it('adds a type over a range', () => {
    expect(toggleMark([], 'italic', 2, 6)).toEqual([{ type: 'italic', offset: 2, length: 4 }]);
  });
  it('removes a type when the range is fully that type, leaving other types intact', () => {
    const marks = [
      { type: 'bold' as const, offset: 0, length: 6 },
      { type: 'italic' as const, offset: 0, length: 6 },
    ];
    // Sorted by offset, then type: bold@0, italic@0, bold@4.
    expect(toggleMark(marks, 'bold', 2, 4)).toEqual([
      { type: 'bold', offset: 0, length: 2 },
      { type: 'italic', offset: 0, length: 6 },
      { type: 'bold', offset: 4, length: 2 },
    ]);
  });
  it('toggles types independently on the same range', () => {
    let marks = toggleMark([], 'bold', 0, 4);
    marks = toggleMark(marks, 'underline', 0, 4);
    expect(marks).toEqual([
      { type: 'bold', offset: 0, length: 4 },
      { type: 'underline', offset: 0, length: 4 },
    ]);
  });
  it('is a no-op for a collapsed range', () => {
    expect(toggleMark([{ type: 'bold', offset: 0, length: 4 }], 'bold', 3, 3)).toEqual([
      { type: 'bold', offset: 0, length: 4 },
    ]);
  });
});
