import { describe, it, expect, vi } from 'vitest';

// Mock the firebase module to prevent initialization with invalid credentials
vi.mock('../../src/firebase', () => ({ db: {} }));

import { GeoPoint } from 'firebase/firestore';
import { haversineKm } from '../../src/services/feedService';

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    const p = new GeoPoint(40.5, -4.0);
    expect(haversineKm(p, p)).toBe(0);
  });

  it('returns ~111 km for one degree of latitude difference', () => {
    const a = new GeoPoint(40.0, 0.0);
    const b = new GeoPoint(41.0, 0.0);
    const km = haversineKm(a, b);
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112);
  });

  it('returns ~85 km for one degree of longitude at lat 40 (cosine effect)', () => {
    const a = new GeoPoint(40.0, 0.0);
    const b = new GeoPoint(40.0, 1.0);
    const km = haversineKm(a, b);
    expect(km).toBeGreaterThan(84);
    expect(km).toBeLessThan(86);
  });
});
