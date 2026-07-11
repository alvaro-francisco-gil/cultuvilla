// packages/shared/src/services/eventService.ts
import {
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
  getCountFromServer,
  doc,
  type UpdateData,
  type DocumentData,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import {
  eventsCollection,
  eventDoc,
} from '../firebase/refs/client';
import {
  buildEventData,
  eventEndBoundary,
  type EventData,
  type EventDataInput,
  type EventStatus,
} from '../models/event/EventDataModel';

export async function getEvent(eventId: string): Promise<(EventData & { id: string }) | null> {
  const snap = await getDoc(eventDoc(getDb(), eventId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getEventsByMunicipality(
  municipalityId: string,
  status?: EventStatus,
): Promise<(EventData & { id: string })[]> {
  const ref = eventsCollection(getDb());
  const q = status
    ? query(
        ref,
        where('municipalityId', '==', municipalityId),
        where('status', '==', status),
        orderBy('startDate', 'asc'),
      )
    : query(
        ref,
        where('municipalityId', '==', municipalityId),
        orderBy('startDate', 'asc'),
      );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getEventsByOrganization(
  organizationId: string,
): Promise<(EventData & { id: string })[]> {
  const q = query(
    eventsCollection(getDb()),
    where('organizerOrgIds', 'array-contains', organizationId),
    orderBy('startDate', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createEvent(input: EventDataInput): Promise<string> {
  const newRef = doc(eventsCollection(getDb()));
  await setDoc(newRef, buildEventData(input));
  return newRef.id;
}

export async function updateEvent(
  eventId: string,
  data: Partial<Omit<EventData, 'createdAt' | 'createdBy' | 'municipalityId'>>,
): Promise<void> {
  // updateDoc bypasses the converter's toFirestore, so partial-update payloads
  // still need explicit Timestamp conversion for Date fields. Use the untyped
  // doc ref here since the converter type would require Date, not Timestamp.
  const updates: UpdateData<DocumentData> = { ...data, updatedAt: serverTimestamp() };
  if (data.startDate instanceof Date) {
    updates['startDate'] = Timestamp.fromDate(data.startDate);
  }
  if (data.endDate instanceof Date) {
    updates['endDate'] = Timestamp.fromDate(data.endDate);
  }
  // Keep the derived feed key in sync. The edit form always sends startDate and
  // endDate together, so recompute the boundary whenever startDate is patched;
  // a stale endBoundary would silently hide (or wrongly surface) the event.
  if (data.startDate instanceof Date) {
    const boundary = eventEndBoundary({ startDate: data.startDate, endDate: data.endDate ?? null });
    updates['endBoundary'] = Timestamp.fromDate(boundary);
  }
  await updateDoc(doc(getDb(), 'events', eventId), updates);
}

export async function updateEventStatus(eventId: string, status: EventStatus): Promise<void> {
  await updateDoc(doc(getDb(), 'events', eventId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEvent(eventId: string): Promise<void> {
  await deleteDoc(eventDoc(getDb(), eventId));
}

export async function getEventsByOrganizer(
  userId: string,
): Promise<(EventData & { id: string })[]> {
  const q = query(
    eventsCollection(getDb()),
    where('organizerUserIds', 'array-contains', userId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  // A "deleted" event is soft-cancelled (status -> 'cancelled'); the profile's
  // managed-events list must not resurface it. Filtered here rather than in the
  // query to avoid a status+array-contains composite index.
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => e.status !== 'cancelled');
}

export async function getEventCountByOrganizer(userId: string): Promise<number> {
  const q = query(eventsCollection(getDb()), where('organizerUserIds', 'array-contains', userId));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}
