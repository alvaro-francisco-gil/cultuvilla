import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { makeConverter } from '../../../src/firebase/converters/makeConverter';
import type { SdkCtors } from '../../../src/firebase/converters/walkers';

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

const Schema = z.object({
  name: z.string(),
  createdAt: z.date(),
  coords: z.object({ lat: z.number(), lng: z.number() }).nullable(),
});

const converter = makeConverter(Schema, fakeSdk);

describe('makeConverter', () => {
  describe('fromFirestore', () => {
    it('returns the typed model when the doc matches the schema', () => {
      const d = new Date('2026-01-01T00:00:00Z');
      const snap = { data: () => ({ name: 'x', createdAt: new FakeTimestamp(d), coords: new FakeGeoPoint(1, 2) }) };
      expect(converter.fromFirestore(snap)).toEqual({ name: 'x', createdAt: d, coords: { lat: 1, lng: 2 } });
    });

    it('throws when a required field is missing', () => {
      const snap = { data: () => ({ name: 'x', coords: null }) };
      expect(() => converter.fromFirestore(snap)).toThrow();
    });

    it('throws when a field has the wrong type', () => {
      const snap = { data: () => ({ name: 123, createdAt: new FakeTimestamp(new Date()), coords: null }) };
      expect(() => converter.fromFirestore(snap)).toThrow();
    });
  });

  describe('toFirestore', () => {
    it('returns Firestore-shaped data when the model matches the schema', () => {
      const d = new Date('2026-01-01T00:00:00Z');
      const out = converter.toFirestore({ name: 'x', createdAt: d, coords: { lat: 1, lng: 2 } }) as {
        name: string; createdAt: FakeTimestamp; coords: FakeGeoPoint;
      };
      expect(out.name).toBe('x');
      expect(out.createdAt).toBeInstanceOf(FakeTimestamp);
      expect(out.createdAt.toDate()).toEqual(d);
      expect(out.coords).toBeInstanceOf(FakeGeoPoint);
    });

    it('throws when the model does not match the schema', () => {
      // @ts-expect-error -- intentional violation to verify runtime guard
      expect(() => converter.toFirestore({ name: 'x' })).toThrow();
    });
  });
});
