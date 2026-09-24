import { describe, it, expect } from 'vitest';
import { minimumBopYear } from '../../src/models/business/BusinessSnapshot';

// The provincial bulletin publishes year Y+1's local holidays in about September
// of year Y (2026's resolution: 16-09-2025, published 19-09-2025). So from
// October the next year's list should exist, and a dataset still on the current
// year is going stale.
describe('minimumBopYear', () => {
  it('requires only the current year before October', () => {
    expect(minimumBopYear('2026-09-24')).toBe(2026);
    expect(minimumBopYear('2026-01-02')).toBe(2026);
  });

  it('requires next year from 1 October, once the resolution is out', () => {
    expect(minimumBopYear('2026-10-01')).toBe(2027);
    expect(minimumBopYear('2026-12-31')).toBe(2027);
  });
});
