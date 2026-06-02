import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/firebase', () => ({ db: {} }));

import { filterByDistanceKm } from '../../src/services/feedService';

describe('filterByDistanceKm', () => {
  const reference = { lat: 40.0, lng: 0.0 };

  it('keeps events within the radius', () => {
    const events = [
      { id: 'near', municipalityCoordinates: { lat: 40.0, lng: 0.0 } },
      { id: 'far', municipalityCoordinates: { lat: 41.0, lng: 0.0 } }, // ~111 km
    ];
    const out = filterByDistanceKm(events, reference, 50);
    expect(out.map((e) => e.id)).toEqual(['near']);
  });

  it('drops events with null municipalityCoordinates', () => {
    const events = [
      { id: 'no-coords', municipalityCoordinates: null },
      { id: 'has-coords', municipalityCoordinates: { lat: 40.0, lng: 0.0 } },
    ];
    const out = filterByDistanceKm(events, reference, 10);
    expect(out.map((e) => e.id)).toEqual(['has-coords']);
  });

  it('keeps events exactly at the boundary distance', () => {
    const events = [{ id: 'edge', municipalityCoordinates: { lat: 40.0, lng: 0.0 } }];
    const out = filterByDistanceKm(events, reference, 0);
    expect(out).toHaveLength(1);
  });

  it('returns empty array when nothing matches', () => {
    const events = [
      { id: 'far1', municipalityCoordinates: { lat: 50.0, lng: 50.0 } },
    ];
    expect(filterByDistanceKm(events, reference, 1)).toEqual([]);
  });
});
