import { describe, it, expect } from 'vitest';

import {
  clampMapZoom,
  MAP_ZOOM_MIN,
  MAP_ZOOM_MAX,
  MAP_ZOOM_DEFAULT,
} from '../../src/services/mapsService';

describe('clampMapZoom', () => {
  it('keeps in-range values', () => {
    expect(clampMapZoom(13)).toBe(13);
    expect(clampMapZoom(MAP_ZOOM_MIN)).toBe(MAP_ZOOM_MIN);
    expect(clampMapZoom(MAP_ZOOM_MAX)).toBe(MAP_ZOOM_MAX);
  });

  it('clamps below min and above max', () => {
    expect(clampMapZoom(MAP_ZOOM_MIN - 5)).toBe(MAP_ZOOM_MIN);
    expect(clampMapZoom(MAP_ZOOM_MAX + 5)).toBe(MAP_ZOOM_MAX);
  });

  it('rounds fractional zooms', () => {
    expect(clampMapZoom(12.6)).toBe(13);
  });

  it('falls back to default for non-finite input', () => {
    expect(clampMapZoom(Number.NaN)).toBe(MAP_ZOOM_DEFAULT);
  });
});
