import { describe, it, expect } from 'vitest';
import { GeoPoint } from 'firebase/firestore';
import { buildLocationData } from '../../src/models/core/LocationDataModel';

describe('buildLocationData', () => {
  it('defaults to type=text with both coordinates and text null', () => {
    const loc = buildLocationData();
    expect(loc.type).toBe('text');
    expect(loc.coordinates).toBeNull();
    expect(loc.text).toBeNull();
  });

  it('keeps text and drops coordinates when type=text', () => {
    const loc = buildLocationData({
      type: 'text',
      text: 'Plaza Mayor',
      coordinates: new GeoPoint(40, -4),
    });
    expect(loc.type).toBe('text');
    expect(loc.text).toBe('Plaza Mayor');
    expect(loc.coordinates).toBeNull();
  });

  it('keeps coordinates and drops text when type=coordinates', () => {
    const gp = new GeoPoint(40.5, -4.1);
    const loc = buildLocationData({
      type: 'coordinates',
      coordinates: gp,
      text: 'should be dropped',
    });
    expect(loc.type).toBe('coordinates');
    expect(loc.coordinates).toBe(gp);
    expect(loc.text).toBeNull();
  });

  it('allows coordinates type with null coordinates', () => {
    const loc = buildLocationData({ type: 'coordinates' });
    expect(loc.type).toBe('coordinates');
    expect(loc.coordinates).toBeNull();
    expect(loc.text).toBeNull();
  });
});
