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
import type {
  EventData,
  EventDataInput,
  EventStatus,
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
    where('organizationId', '==', organizationId),
    orderBy('startDate', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createEvent(input: EventDataInput): Promise<string> {
  const newRef = doc(eventsCollection(getDb()));
  const now = new Date();
  const event: EventData = {
    title: input.title,
    description: input.description,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    location: input.location,
    imageURL: input.imageURL ?? null,
    maxAttendees: input.maxAttendees ?? null,
    telephoneRequired: input.telephoneRequired ?? false,
    status: input.status ?? 'published',
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    municipalityId: input.municipalityId,
    municipalityName: input.municipalityName,
    municipalityCoverImage: input.municipalityCoverImage ?? null,
    municipalityCoordinates: input.municipalityCoordinates,
  };
  await setDoc(newRef, event);
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
  } else if (data.endDate === null) {
    updates['endDate'] = null;
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

export async function getEventsByCreator(
  userId: string,
): Promise<(EventData & { id: string })[]> {
  const q = query(
    eventsCollection(getDb()),
    where('createdBy', '==', userId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getEventCountByCreator(userId: string): Promise<number> {
  const q = query(eventsCollection(getDb()), where('createdBy', '==', userId));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}
