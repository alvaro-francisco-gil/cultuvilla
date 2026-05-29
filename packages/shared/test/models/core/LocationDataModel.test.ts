import { describe, it, expect } from 'vitest';
import { LocationDataSchema, buildLocationData } from '../../../src/models/core/LocationDataModel';

describe('LocationDataSchema', () => {
  it('accepts a coordinates location with {lat, lng}', () => {
    const parsed = LocationDataSchema.parse({
      type: 'coordinates',
      coordinates: { lat: 40.4, lng: -3.7 },
      text: null,
    });
    expect(parsed.coordinates).toEqual({ lat: 40.4, lng: -3.7 });
  });

  it('accepts a text location with null coordinates', () => {
    expect(() => LocationDataSchema.parse({
      type: 'text',
      coordinates: null,
      text: 'Main square',
    })).not.toThrow();
  });

  it('rejects malformed coordinates', () => {
    expect(() => LocationDataSchema.parse({
      type: 'coordinates',
      coordinates: { lat: 'forty', lng: -3.7 },
      text: null,
    })).toThrow();
  });
});

describe('buildLocationData', () => {
  it('defaults to a text location with both fields null', () => {
    expect(buildLocationData()).toEqual({ type: 'text', coordinates: null, text: null });
  });

  it('clears coordinates when type is text', () => {
    const data = buildLocationData({ type: 'text', coordinates: { lat: 1, lng: 2 }, text: 'x' });
    expect(data.coordinates).toBeNull();
  });
});
