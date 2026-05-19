import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  getDocs,
  Timestamp,
  GeoPoint,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import { mapEventDoc } from './eventService';
import type { EventData } from '../models/event/EventDataModel';

export interface FeedPage {
  events: (EventData & { id: string })[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
}

export async function getUpcomingFeed(
  pageSize: number = 20,
  cursor: QueryDocumentSnapshot<DocumentData> | null = null,
): Promise<FeedPage> {
  const baseConstraints = [
    where('status', '==', 'published'),
    where('startDate', '>=', Timestamp.now()),
    orderBy('startDate', 'asc'),
    firestoreLimit(pageSize),
  ];
  const q = cursor
    ? query(collection(getDb(), 'events'), ...baseConstraints, startAfter(cursor))
    : query(collection(getDb(), 'events'), ...baseConstraints);

  const snap = await getDocs(q);
  const events = snap.docs.map((d) => mapEventDoc(d as Parameters<typeof mapEventDoc>[0]));
  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { events, cursor: lastDoc };
}

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two GeoPoints in kilometers.
 * Pure function; no Firebase calls.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

export function filterByDistanceKm<T extends { municipalityCoordinates: GeoPoint | null }>(
  events: T[],
  reference: GeoPoint,
  maxKm: number,
): T[] {
  return events.filter(
    (e) => e.municipalityCoordinates !== null && haversineKm(reference, e.municipalityCoordinates) <= maxKm,
  );
}
