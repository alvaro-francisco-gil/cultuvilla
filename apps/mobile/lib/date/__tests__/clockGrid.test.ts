import {
  clockPositions,
  hourRings,
  minuteTicks,
  setClockHour,
  setClockMinute,
  roundUpToMinuteStep,
} from '../clockGrid';

describe('clockPositions', () => {
  it('places index 0 at top and index n/4 at the right (clockwise)', () => {
    const p = clockPositions([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 100);
    expect(p[0]!.value).toBe(12);
    expect(Math.round(p[0]!.x)).toBe(0);
    expect(Math.round(p[0]!.y)).toBe(-100); // top
    expect(Math.round(p[3]!.x)).toBe(100); // 3 o'clock, right
    expect(Math.round(p[3]!.y)).toBe(0);
  });
});

describe('hourRings', () => {
  it('outer is 12 then 1..11; inner is 0 then 13..23', () => {
    const { outer, inner } = hourRings();
    expect(outer).toEqual([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(inner).toEqual([0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
  });
});

describe('minuteTicks', () => {
  it('returns 60/step entries', () => {
    expect(minuteTicks(5)).toHaveLength(12);
    expect(minuteTicks(5).at(-1)).toBe(55);
  });
  it('rejects a step that does not divide 60', () => {
    expect(() => minuteTicks(7)).toThrow();
  });
});

describe('setClockHour / setClockMinute', () => {
  it('sets one field, zeroes seconds, preserves the rest', () => {
    const base = new Date(2026, 6, 1, 9, 30, 45);
    const h = setClockHour(base, 20);
    expect(h.getHours()).toBe(20);
    expect(h.getMinutes()).toBe(30);
    expect(h.getSeconds()).toBe(0);
    const m = setClockMinute(base, 5);
    expect(m.getMinutes()).toBe(5);
    expect(m.getHours()).toBe(9);
    expect(m.getSeconds()).toBe(0);
  });
});

describe('roundUpToMinuteStep', () => {
  it('rounds minutes up to the next step, seconds zeroed', () => {
    expect(roundUpToMinuteStep(new Date(2026, 6, 1, 9, 31, 10), 5).getMinutes()).toBe(35);
    expect(roundUpToMinuteStep(new Date(2026, 6, 1, 9, 30, 0), 5).getMinutes()).toBe(30); // already aligned
    const wrap = roundUpToMinuteStep(new Date(2026, 6, 1, 9, 58, 0), 5);
    expect(wrap.getHours()).toBe(10);
    expect(wrap.getMinutes()).toBe(0);
  });
});
