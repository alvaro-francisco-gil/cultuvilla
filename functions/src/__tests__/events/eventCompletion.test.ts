import { describe, it, expect } from 'vitest';
import { isStartDayOver } from '@cultuvilla/shared/models';

describe('isStartDayOver', () => {
  it('false later same Madrid day', () => {
    expect(isStartDayOver(new Date('2026-06-15T08:00:00Z'), new Date('2026-06-15T21:00:00Z'))).toBe(false);
  });
  it('true next Madrid day', () => {
    expect(isStartDayOver(new Date('2026-06-15T08:00:00Z'), new Date('2026-06-15T23:30:00Z'))).toBe(true);
  });
});
