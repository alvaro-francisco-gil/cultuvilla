import { buildMonthMatrix, isSameDay, isDayDisabled, clampMonth } from '../calendarGrid';

describe('buildMonthMatrix', () => {
  it('returns 42 cells, Monday-first', () => {
    const cells = buildMonthMatrix(2026, 6); // July 2026, 1st is a Wednesday
    expect(cells).toHaveLength(42);
    // Monday-first: Jul 1 (Wed) sits at index 2; indices 0-1 are prior-month days.
    expect(cells[2].date.getDate()).toBe(1);
    expect(cells[2].inMonth).toBe(true);
    expect(cells[0].inMonth).toBe(false);
    expect(cells[1].inMonth).toBe(false);
  });

  it('flags trailing next-month days out of month', () => {
    const cells = buildMonthMatrix(2026, 6);
    const last = cells[cells.length - 1];
    expect(last.inMonth).toBe(false);
  });
});

describe('isSameDay', () => {
  it('ignores time-of-day', () => {
    expect(isSameDay(new Date(2026, 6, 1, 9, 0), new Date(2026, 6, 1, 23, 59))).toBe(true);
    expect(isSameDay(new Date(2026, 6, 1), new Date(2026, 6, 2))).toBe(false);
  });
});

describe('isDayDisabled', () => {
  it('respects min/max by calendar day', () => {
    const min = new Date(2026, 6, 10, 23, 0);
    expect(isDayDisabled(new Date(2026, 6, 10, 0, 0), min)).toBe(false); // same day allowed
    expect(isDayDisabled(new Date(2026, 6, 9), min)).toBe(true);
    const max = new Date(2026, 6, 10);
    expect(isDayDisabled(new Date(2026, 6, 11), undefined, max)).toBe(true);
  });
});

describe('clampMonth', () => {
  it('wraps month underflow/overflow', () => {
    expect(clampMonth(2026, -1)).toEqual({ year: 2025, month: 11 });
    expect(clampMonth(2026, 12)).toEqual({ year: 2027, month: 0 });
  });
});
