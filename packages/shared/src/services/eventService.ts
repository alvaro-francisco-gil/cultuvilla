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

type EventWithId = EventData & { id: string };

/**
 * Every list query over `events` MUST constrain visibility itself. Firestore
 * rules are not a filter: a `list` rule that turns on a field the query leaves
 * unconstrained is evaluated against what the query *could* return, so an
 * unpinned query is not reliably denied — it can hand back the private rows.
 * Where the rule *can* prove the denial it fails the whole page instead. Both
 * outcomes are wrong for a feed, and both are avoided the same way: ask only
 * for what the viewer may read.
 */
const publicOnly = () => where('visibility', '==', 'public');

export async function getEvent(eventId: string): Promise<(EventData & { id: string }) | null> {
  const snap = await getDoc(eventDoc(getDb(), eventId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getEventsByMunicipality(
  municipalityId: string,
  status?: EventStatus | EventStatus[],
): Promise<(EventData & { id: string })[]> {
  const ref = eventsCollection(getDb());
  // A status array becomes an `in` filter (e.g. the pueblo tab wants
  // 'published' + 'completed' so past events survive the completion job);
  // a single status stays an equality filter. Both reuse the
  // municipalityId + status + startDate composite index.
  const statusConstraint = Array.isArray(status)
    ? [where('status', 'in', status)]
    : status
      ? [where('status', '==', status)]
      : [];
  const q = query(
    ref,
    where('municipalityId', '==', municipalityId),
    publicOnly(),
    ...statusConstraint,
    orderBy('startDate', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * The private half of `getEventsByMunicipality`: the events restricted to one
 * of the caller's own organizations. Queried per org — never with an `in` over
 * several — so that every document a page returns shares one membership
 * document, keeping the read rule's `get()` inside its per-request budget.
 *
 * Orgs belong to exactly one municipality, so the village filter is applied in
 * memory rather than costing a fourth index field.
 */
export async function getPrivateEventsByMunicipality(
  municipalityId: string,
  orgIds: string[],
  status?: EventStatus | EventStatus[],
): Promise<EventWithId[]> {
  if (orgIds.length === 0) return [];
  const statusConstraint = Array.isArray(status)
    ? [where('status', 'in', status)]
    : status
      ? [where('status', '==', status)]
      : [];
  const pages = await Promise.all(
    orgIds.map(async (orgId) => {
      const snap = await getDocs(
        query(
          eventsCollection(getDb()),
          where('visibilityOrgId', '==', orgId),
          ...statusConstraint,
          orderBy('startDate', 'asc'),
        ),
      );
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }),
  );
  return pages
    .flat()
    .filter((e) => e.municipalityId === municipalityId)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

/**
 * The org detail screen's event list. `includePrivate` must be true only when
 * the caller is a member of `organizationId` (or an app admin) — a non-member
 * asking for the private rows does not get a shorter list, they get a
 * permission-denied that empties the whole section.
 */
export async function getEventsByOrganization(
  organizationId: string,
  { includePrivate = false }: { includePrivate?: boolean } = {},
): Promise<EventWithId[]> {
  const q = query(
    eventsCollection(getDb()),
    where('organizerOrgIds', 'array-contains', organizationId),
    ...(includePrivate ? [] : [publicOnly()]),
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
