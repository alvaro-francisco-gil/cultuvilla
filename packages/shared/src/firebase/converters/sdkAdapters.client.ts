import { Timestamp, GeoPoint } from 'firebase/firestore';
import type { SdkCtors } from './walkers';

export const clientSdkCtors: SdkCtors = {
  TimestampFromDate: (d) => Timestamp.fromDate(d),
  GeoPointFrom: (lat, lng) => new GeoPoint(lat, lng),
  isTimestamp: (v): v is { toDate(): Date } => v instanceof Timestamp,
  isGeoPoint: (v): v is { latitude: number; longitude: number } => v instanceof GeoPoint,
};
