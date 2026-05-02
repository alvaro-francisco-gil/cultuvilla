import {
  collection,
  doc,
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
  GeoPoint,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { EventData, EventDataInput, EventStatus } from '../models/event/EventDataModel';
import type { LocationData } from '../models/core/LocationDataModel';

function eventsCol() {
  return collection(db, 'events');
}

function mapLocationData(raw: Record<string, unknown>): LocationData {
  return {
    type: raw['type'] as LocationData['type'],
    coordinates: raw['coordinates'] ? (raw['coordinates'] as GeoPoint) : null,
    text: (raw['text'] as string | null) ?? null,
  };
}

export function mapEventDoc(
  d: { id: string; data: () => Record<string, unknown> }
): EventData & { id: string } {
  const data = d.data();
  const endDateRaw = data['endDate'];
  return {
    id: d.id,
    title: data['title'] as string,
    description: data['description'] as string,
    startDate: (data['startDate'] as Timestamp).toDate(),
    endDate: endDateRaw ? (endDateRaw as Timestamp).toDate() : null,
    location: mapLocationData(data['location'] as Record<string, unknown>),
    imageURL: (data['imageURL'] as string | null) ?? null,
    price: (data['price'] as number | null) ?? null,
    maxAttendees: (data['maxAttendees'] as number | null) ?? null,
    telephoneRequired: (data['telephoneRequired'] as boolean) ?? false,
    status: data['status'] as EventStatus,
    organizationId: data['organizationId'] as string,
    organizationName: data['organizationName'] as string,
    createdBy: data['createdBy'] as string,
    createdAt: (data['createdAt'] as Timestamp).toDate(),
    updatedAt: (data['updatedAt'] as Timestamp).toDate(),
    villageId: data['villageId'] as string,
    villageName: data['villageName'] as string,
    villageCoverImage: (data['villageCoverImage'] as string | null) ?? null,
    villageCoordinates: data['villageCoordinates'] as GeoPoint,
  };
}

export async function getEvent(eventId: string): Promise<(EventData & { id: string }) | null> {
  const snap = await getDoc(doc(eventsCol(), eventId));
  if (!snap.exists()) return null;
  return mapEventDoc(snap as Parameters<typeof mapEventDoc>[0]);
}

export async function getEventsByVillage(
  villageId: string,
  status?: EventStatus
): Promise<(EventData & { id: string })[]> {
  const constraints = status
    ? [where('villageId', '==', villageId), where('status', '==', status), orderBy('startDate', 'asc')]
    : [where('villageId', '==', villageId), orderBy('startDate', 'asc')];
  const q = query(eventsCol(), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapEventDoc(d as Parameters<typeof mapEventDoc>[0]));
}

export async function getEventsByOrganization(
  organizationId: string
): Promise<(EventData & { id: string })[]> {
  const q = query(
    eventsCol(),
    where('organizationId', '==', organizationId),
    orderBy('startDate', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapEventDoc(d as Parameters<typeof mapEventDoc>[0]));
}

export async function createEvent(input: EventDataInput): Promise<string> {
  const newRef = doc(eventsCol());
  await setDoc(newRef, {
    title: input.title,
    description: input.description,
    startDate: Timestamp.fromDate(input.startDate),
    endDate: input.endDate ? Timestamp.fromDate(input.endDate) : null,
    location: input.location,
    imageURL: input.imageURL ?? null,
    price: input.price ?? null,
    maxAttendees: input.maxAttendees ?? null,
    telephoneRequired: input.telephoneRequired ?? false,
    status: input.status ?? 'draft',
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    villageId: input.villageId,
    villageName: input.villageName,
    villageCoverImage: input.villageCoverImage ?? null,
    villageCoordinates: input.villageCoordinates,
  });
  return newRef.id;
}

export async function updateEvent(
  eventId: string,
  data: Partial<Omit<EventData, 'createdAt' | 'createdBy' | 'villageId'>>
): Promise<void> {
  const updates: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (data.startDate instanceof Date) {
    updates['startDate'] = Timestamp.fromDate(data.startDate);
  }
  if (data.endDate instanceof Date) {
    updates['endDate'] = Timestamp.fromDate(data.endDate);
  } else if (data.endDate === null) {
    updates['endDate'] = null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(eventsCol(), eventId), updates as any);
}

export async function updateEventStatus(eventId: string, status: EventStatus): Promise<void> {
  await updateDoc(doc(eventsCol(), eventId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEvent(eventId: string): Promise<void> {
  await deleteDoc(doc(eventsCol(), eventId));
}
