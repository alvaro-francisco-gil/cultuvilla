import { Timestamp, GeoPoint } from 'firebase/firestore';
import type { SdkCtors } from './walkers';

// Duck-type predicates instead of `instanceof` — see sdkAdapters.admin.ts
// for the rationale. Browser bundles can also end up with multiple copies
// of firebase/firestore in pathological setups (multiple chunk graphs); the
// duck check is robust either way.
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
    && Object.keys(v).every((k) => k === 'latitude' || k === 'longitude')
  );
}

export const clientSdkCtors: SdkCtors = {
  TimestampFromDate: (d) => Timestamp.fromDate(d),
  GeoPointFrom: (lat, lng) => new GeoPoint(lat, lng),
  isTimestamp: isTimestampLike,
  isGeoPoint: isGeoPointLike,
};
