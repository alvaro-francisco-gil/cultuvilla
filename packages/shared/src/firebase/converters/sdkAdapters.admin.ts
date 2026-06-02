import { Timestamp, GeoPoint } from 'firebase-admin/firestore';
import type { SdkCtors } from './walkers';

export const adminSdkCtors: SdkCtors = {
  TimestampFromDate: (d) => Timestamp.fromDate(d),
  GeoPointFrom: (lat, lng) => new GeoPoint(lat, lng),
  isTimestamp: (v): v is { toDate(): Date } => v instanceof Timestamp,
  isGeoPoint: (v): v is { latitude: number; longitude: number } => v instanceof GeoPoint,
};
