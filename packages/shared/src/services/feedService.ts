import {
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  getDocs,
  Timestamp,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import { eventsCollection } from '../firebase/refs/client';
import type { EventData } from '../models/event/EventDataModel';
import type { LatLng } from '../models/core/LocationDataModel';

export interface FeedPage {
  events: (EventData & { id: string })[];
  cursor: QueryDocumentSnapshot<EventData> | null;
}

export async function getUpcomingFeed(
  pageSize: number = 20,
  cursor: QueryDocumentSnapshot<EventData> | null = null,
): Promise<FeedPage> {
  const ref = eventsCollection(getDb());
  // Range on `endBoundary` (endDate ?? startDate), not `startDate`: an event
  // stays in the feed for the whole of its (last) day, so one that started
  // earlier today or a multi-day event mid-run still shows. The lower bound is
  // the start of today, not `now` — completeExpiredEvents flips genuinely-past
  // events to `completed`, so the status filter drops them. Firestore requires
  // the first orderBy to match the inequality field, hence orderBy(endBoundary).
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const baseConstraints = [
    where('status', '==', 'published'),
    where('endBoundary', '>=', Timestamp.fromDate(startOfToday)),
    orderBy('endBoundary', 'asc'),
    firestoreLimit(pageSize),
  ];
  const q = cursor
    ? query(ref, ...baseConstraints, startAfter(cursor))
    : query(ref, ...baseConstraints);

  const snap = await getDocs(q);
  const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lastDoc = snap.docs.length > 0 ? (snap.docs[snap.docs.length - 1] ?? null) : null;
  return { events, cursor: lastDoc };
}

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two coordinates in kilometers.
 * Pure function; no Firebase calls.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

export function filterByDistanceKm<T extends { villageCoordinates: LatLng | null }>(
  events: T[],
  reference: LatLng,
  maxKm: number,
): T[] {
  return events.filter(
    (e) => e.villageCoordinates !== null && haversineKm(reference, e.villageCoordinates) <= maxKm,
  );
}
