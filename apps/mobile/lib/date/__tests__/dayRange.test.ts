import { dateOfKey, dayKeyOf, formatDayRange, nextRangeSelection } from '../dayRange';

describe('dayKeyOf / dateOfKey', () => {
  it('round-trips a calendar day', () => {
    expect(dayKeyOf(dateOfKey('2026-08-04'))).toBe('2026-08-04');
    expect(dayKeyOf(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('nextRangeSelection', () => {
  it('takes the first tap as the first day and the second as the last', () => {
    const first = nextRangeSelection({ startDay: null, endDay: null }, '2026-08-14');
    expect(first).toEqual({ startDay: '2026-08-14', endDay: null });
    expect(nextRangeSelection(first, '2026-08-28')).toEqual({ startDay: '2026-08-14', endDay: '2026-08-28' });
  });

  it('allows a one-day range', () => {
    expect(nextRangeSelection({ startDay: '2026-07-25', endDay: null }, '2026-07-25')).toEqual({
      startDay: '2026-07-25',
      endDay: '2026-07-25',
    });
  });

  it('restarts from a day before the first, instead of a backwards range', () => {
    expect(nextRangeSelection({ startDay: '2026-08-14', endDay: null }, '2026-08-10')).toEqual({
      startDay: '2026-08-10',
      endDay: null,
    });
  });

  it('starts over once a range is complete', () => {
    expect(nextRangeSelection({ startDay: '2026-08-14', endDay: '2026-08-28' }, '2026-08-20')).toEqual({
      startDay: '2026-08-20',
      endDay: null,
    });
  });
});

describe('formatDayRange', () => {
  it('writes the month once inside a month', () => {
    expect(formatDayRange({ startDay: '2026-07-24', endDay: '2026-07-26' })).toBe('24 – 26 jul');
  });

  it('names both months across a boundary', () => {
    expect(formatDayRange({ startDay: '2026-07-30', endDay: '2026-08-02' })).toBe('30 jul – 2 ago');
  });

  it('writes a single day once', () => {
    expect(formatDayRange({ startDay: '2026-07-25', endDay: '2026-07-25' })).toBe('25 jul');
  });
});
