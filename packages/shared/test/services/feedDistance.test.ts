import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/firebase', () => ({ db: {} }));

import { GeoPoint } from 'firebase/firestore';
import { filterByDistanceKm } from '../../src/services/feedService';

describe('filterByDistanceKm', () => {
  const reference = new GeoPoint(40.0, 0.0);

  it('keeps events within the radius', () => {
    const events = [
      { id: 'near', villageCoordinates: new GeoPoint(40.0, 0.0) },
      { id: 'far', villageCoordinates: new GeoPoint(41.0, 0.0) }, // ~111 km
    ];
    const out = filterByDistanceKm(events, reference, 50);
    expect(out.map((e) => e.id)).toEqual(['near']);
  });

  it('drops events with null villageCoordinates', () => {
    const events = [
      { id: 'no-coords', villageCoordinates: null },
      { id: 'has-coords', villageCoordinates: new GeoPoint(40.0, 0.0) },
    ];
    const out = filterByDistanceKm(events, reference, 10);
    expect(out.map((e) => e.id)).toEqual(['has-coords']);
  });

  it('keeps events exactly at the boundary distance', () => {
    const events = [{ id: 'edge', villageCoordinates: new GeoPoint(40.0, 0.0) }];
    const out = filterByDistanceKm(events, reference, 0);
    expect(out).toHaveLength(1);
  });

  it('returns empty array when nothing matches', () => {
    const events = [
      { id: 'far1', villageCoordinates: new GeoPoint(50.0, 50.0) },
    ];
    expect(filterByDistanceKm(events, reference, 1)).toEqual([]);
  });
});
