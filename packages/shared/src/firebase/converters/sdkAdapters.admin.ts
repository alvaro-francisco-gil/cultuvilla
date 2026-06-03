import { Timestamp, GeoPoint } from 'firebase-admin/firestore';
import type { SdkCtors } from './walkers';

// Duck-type predicates instead of `instanceof`. functions/ is npm-installed
// while packages/shared is pnpm-installed; they each end up with their own
// copy of @google-cloud/firestore, so `instanceof` returns false for a
// Timestamp/GeoPoint created in functions and seen by shared (the converters
// live in shared but receive values from functions's admin SDK). The duck
// checks are stable across copies and survive any future package-manager
// reshuffles.
function isTimestampLike(v: unknown): v is { toDate(): Date } {
  return (
    typeof v === 'object'
    && v !== null
    && typeof (v as { toDate?: unknown }).toDate === 'function'
    && typeof (v as { toMillis?: unknown }).toMillis === 'function'
  );
}

function isGeoPointLike(v: unknown): v is { latitude: number; longitude: number } {
  return (
    typeof v === 'object'
    && v !== null
    && typeof (v as { latitude?: unknown }).latitude === 'number'
    && typeof (v as { longitude?: unknown }).longitude === 'number'
    // Exclude our schema-shape {lat, lng}: GeoPoint has latitude/longitude
    // (full words). LatLng would already have been normalized away.
    && Object.keys(v).every((k) => k === 'latitude' || k === 'longitude')
  );
}

export const adminSdkCtors: SdkCtors = {
  TimestampFromDate: (d) => Timestamp.fromDate(d),
  GeoPointFrom: (lat, lng) => new GeoPoint(lat, lng),
  isTimestamp: isTimestampLike,
  isGeoPoint: isGeoPointLike,
};
