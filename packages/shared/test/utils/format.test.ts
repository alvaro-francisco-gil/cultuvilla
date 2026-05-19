import { describe, expect, it } from 'vitest';
import { formatDate } from '../../src/utils/format';

describe('formatDate', () => {
  const d = new Date('2026-05-19T15:30:00.000Z');

  it('formats short (numeric date)', () => {
    expect(formatDate(d, 'short')).toMatch(/19\/05\/2026|19\/5\/2026/);
  });

  it('formats long (with weekday + month name)', () => {
    const out = formatDate(d, 'long');
    expect(out).toMatch(/martes/i);
    expect(out).toMatch(/mayo/i);
    expect(out).toMatch(/2026/);
  });

  it('formats time-only', () => {
    // Output depends on the host TZ; assert the shape, not the wall clock.
    expect(formatDate(d, 'time')).toMatch(/\d{1,2}:\d{2}/);
  });

  it('formats datetime (date + time)', () => {
    expect(formatDate(d, 'datetime')).toMatch(/2026/);
    expect(formatDate(d, 'datetime')).toMatch(/\d{1,2}:\d{2}/);
  });
});
