import { describe, it, expect } from 'vitest';
import { LocationDataSchema, buildLocationData } from '../../../src/models/core/LocationDataModel';

describe('LocationDataSchema', () => {
  it('accepts coordinates + displayName', () => {
    expect(LocationDataSchema.parse({ coordinates: { lat: 40.4, lng: -3.7 }, displayName: 'Plaza Mayor' }))
      .toEqual({ coordinates: { lat: 40.4, lng: -3.7 }, displayName: 'Plaza Mayor' });
  });
  it('rejects a missing displayName', () => {
    expect(() => LocationDataSchema.parse({ coordinates: { lat: 1, lng: 2 } })).toThrow();
  });
  it('rejects malformed coordinates', () => {
    expect(() => LocationDataSchema.parse({ coordinates: { lat: 'x', lng: -3.7 }, displayName: 'y' })).toThrow();
  });
});

describe('buildLocationData', () => {
  it('passes coordinates and displayName through', () => {
    expect(buildLocationData({ coordinates: { lat: 1, lng: 2 }, displayName: 'Sede' }))
      .toEqual({ coordinates: { lat: 1, lng: 2 }, displayName: 'Sede' });
  });
});
