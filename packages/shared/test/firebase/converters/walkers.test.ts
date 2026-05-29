import { describe, it, expect } from 'vitest';
import { normalize, denormalize, type SdkCtors } from '../../../src/firebase/converters/walkers';

// Fake SDK ctors that mimic Timestamp/GeoPoint shape (constructors return tagged objects).
class FakeTimestamp {
  constructor(private readonly d: Date) {}
  toDate(): Date { return this.d; }
}
class FakeGeoPoint {
  constructor(public readonly latitude: number, public readonly longitude: number) {}
}
const fakeSdk: SdkCtors = {
  TimestampFromDate: (d) => new FakeTimestamp(d),
  GeoPointFrom: (lat, lng) => new FakeGeoPoint(lat, lng),
  isTimestamp: (v): v is { toDate(): Date } => v instanceof FakeTimestamp,
  isGeoPoint: (v): v is { latitude: number; longitude: number } => v instanceof FakeGeoPoint,
};

describe('normalize', () => {
  it('converts Timestamp instances to Date', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    const input = { createdAt: new FakeTimestamp(d) };
    expect(normalize(input, fakeSdk)).toEqual({ createdAt: d });
  });

  it('converts GeoPoint instances to {lat, lng}', () => {
    const input = { coords: new FakeGeoPoint(40.4, -3.7) };
    expect(normalize(input, fakeSdk)).toEqual({ coords: { lat: 40.4, lng: -3.7 } });
  });

  it('recurses into nested objects and arrays', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    const input = {
      events: [
        { startDate: new FakeTimestamp(d), location: { coords: new FakeGeoPoint(1, 2) } },
      ],
    };
    expect(normalize(input, fakeSdk)).toEqual({
      events: [{ startDate: d, location: { coords: { lat: 1, lng: 2 } } }],
    });
  });

  it('passes primitives and null through unchanged', () => {
    expect(normalize({ a: 1, b: 'x', c: null, d: false }, fakeSdk)).toEqual({
      a: 1, b: 'x', c: null, d: false,
    });
  });
});

describe('denormalize', () => {
  it('converts Date instances to Timestamp via TimestampFromDate', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    const out = denormalize({ createdAt: d }, fakeSdk) as { createdAt: FakeTimestamp };
    expect(out.createdAt).toBeInstanceOf(FakeTimestamp);
    expect(out.createdAt.toDate()).toEqual(d);
  });

  it('converts {lat, lng} objects to GeoPoint via GeoPointFrom', () => {
    const out = denormalize({ coords: { lat: 40.4, lng: -3.7 } }, fakeSdk) as { coords: FakeGeoPoint };
    expect(out.coords).toBeInstanceOf(FakeGeoPoint);
    expect(out.coords.latitude).toBe(40.4);
    expect(out.coords.longitude).toBe(-3.7);
  });

  it('does NOT treat objects with extra keys as coordinates', () => {
    const input = { thing: { lat: 1, lng: 2, label: 'home' } };
    const out = denormalize(input, fakeSdk) as { thing: Record<string, unknown> };
    expect(out.thing).toEqual({ lat: 1, lng: 2, label: 'home' });
  });

  it('passes primitives and null through unchanged', () => {
    expect(denormalize({ a: 1, b: 'x', c: null, d: false }, fakeSdk)).toEqual({
      a: 1, b: 'x', c: null, d: false,
    });
  });
});
