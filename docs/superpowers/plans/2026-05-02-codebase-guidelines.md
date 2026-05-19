# Codebase Guidelines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Firestore data converters to all 10 model files, wire them into all services, write a CLAUDE.md, and add ESLint + lint-staged pre-commit hooks.

**Architecture:** Converters live in model files alongside their `build*Data` functions. Services apply `.withConverter()` on doc/collection refs for reads and drop all `mapXDoc` helper functions. Write paths (setDoc/updateDoc with serverTimestamp()) are unchanged. ESLint runs on pre-commit via lint-staged + husky.

**Tech Stack:** TypeScript 5.8, Firebase v11 (`FirestoreDataConverter`), ESLint 9 flat config, `eslint-config-next`, `@typescript-eslint`, husky 9, lint-staged 16, pnpm workspaces.

---

## Converter pattern reference

Every converter follows this shape. The `toFirestore` method exists to satisfy the interface but write paths in services are not changed — they continue using explicit field objects and `serverTimestamp()`.

```typescript
export const entityConverter: FirestoreDataConverter<EntityData> = {
  toFirestore: (data: EntityData): DocumentData => ({
    ...data,
    someDate: Timestamp.fromDate(data.someDate),
  }),
  fromFirestore: (snap: QueryDocumentSnapshot): EntityData =>
    buildEntityData({
      ...snap.data(),
      someDate: (snap.data().someDate as Timestamp).toDate(),
    } as EntityDataInput),
};
```

Service read pattern after refactor:
```typescript
function entityCol() {
  return collection(db, 'entities').withConverter(entityConverter);
}

export async function getEntity(id: string): Promise<(EntityData & { id: string }) | null> {
  const snap = await getDoc(doc(db, 'entities', id).withConverter(entityConverter));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
```

Mock helper used in all converter tests:
```typescript
function mockSnap(id: string, data: Record<string, unknown>) {
  return { id, data: () => data } as unknown as QueryDocumentSnapshot;
}
```

---

## Task 1: Event domain — converter + service

**Files:**
- Modify: `packages/shared/src/models/event/EventDataModel.ts`
- Modify: `packages/shared/src/services/eventService.ts`
- Create: `packages/shared/test/models/converters.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/models/converters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { GeoPoint, Timestamp } from 'firebase/firestore';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { eventConverter } from '../../src/models/event/EventDataModel';

function mockSnap(id: string, data: Record<string, unknown>) {
  return { id, data: () => data } as unknown as QueryDocumentSnapshot;
}

describe('eventConverter.fromFirestore', () => {
  it('converts Timestamps to Dates and applies buildEventData defaults', () => {
    const start = new Date('2026-08-15T20:00:00Z');
    const created = new Date('2026-05-01T00:00:00Z');
    const snap = mockSnap('event-1', {
      title: 'Fiesta del pueblo',
      description: 'Gran fiesta',
      startDate: Timestamp.fromDate(start),
      endDate: null,
      location: { type: 'text', coordinates: null, text: 'Plaza Mayor' },
      imageURL: null,
      price: null,
      maxAttendees: null,
      telephoneRequired: false,
      status: 'draft',
      organizationId: 'org-1',
      organizationName: 'Ayuntamiento',
      createdBy: 'user-1',
      createdAt: Timestamp.fromDate(created),
      updatedAt: Timestamp.fromDate(created),
      villageId: 'v1',
      villageName: 'Becerril',
      villageCoverImage: null,
      villageCoordinates: new GeoPoint(40.5, -4.0),
    });

    const result = eventConverter.fromFirestore(snap);
    expect(result.startDate).toEqual(start);
    expect(result.createdAt).toEqual(created);
    expect(result.title).toBe('Fiesta del pueblo');
    expect(result.endDate).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /home/powervaro/githubs/cultuvilla && pnpm shared:test
```

Expected: FAIL — `eventConverter` is not exported from EventDataModel.

- [ ] **Step 3: Add `eventConverter` to EventDataModel.ts**

Add after the closing brace of `isEventSignupOpen` at the bottom of `packages/shared/src/models/event/EventDataModel.ts`:

```typescript
import type { FirestoreDataConverter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
```

Add these imports at the top (alongside the existing `GeoPoint` import), then append at the bottom of the file:

```typescript
export const eventConverter: FirestoreDataConverter<EventData> = {
  toFirestore: (data: EventData): DocumentData => ({
    title: data.title,
    description: data.description,
    startDate: Timestamp.fromDate(data.startDate),
    endDate: data.endDate ? Timestamp.fromDate(data.endDate) : null,
    location: data.location,
    imageURL: data.imageURL,
    price: data.price,
    maxAttendees: data.maxAttendees,
    telephoneRequired: data.telephoneRequired,
    status: data.status,
    organizationId: data.organizationId,
    organizationName: data.organizationName,
    createdBy: data.createdBy,
    createdAt: Timestamp.fromDate(data.createdAt),
    updatedAt: Timestamp.fromDate(data.updatedAt),
    villageId: data.villageId,
    villageName: data.villageName,
    villageCoverImage: data.villageCoverImage,
    villageCoordinates: data.villageCoordinates,
  }),
  fromFirestore: (snap: QueryDocumentSnapshot): EventData => {
    const d = snap.data();
    return buildEventData({
      title: d['title'] as string,
      description: d['description'] as string,
      startDate: (d['startDate'] as Timestamp).toDate(),
      endDate: d['endDate'] ? (d['endDate'] as Timestamp).toDate() : null,
      location: d['location'] as EventDataInput['location'],
      imageURL: d['imageURL'] as string | null,
      price: d['price'] as number | null,
      maxAttendees: d['maxAttendees'] as number | null,
      telephoneRequired: d['telephoneRequired'] as boolean,
      status: d['status'] as EventStatus,
      organizationId: d['organizationId'] as string,
      organizationName: d['organizationName'] as string,
      createdBy: d['createdBy'] as string,
      createdAt: (d['createdAt'] as Timestamp).toDate(),
      updatedAt: (d['updatedAt'] as Timestamp).toDate(),
      villageId: d['villageId'] as string,
      villageName: d['villageName'] as string,
      villageCoverImage: d['villageCoverImage'] as string | null,
      villageCoordinates: d['villageCoordinates'] as GeoPoint,
    });
  },
};
```

The full import line at the top should become:
```typescript
import { GeoPoint, Timestamp, type FirestoreDataConverter, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pnpm shared:test
```

Expected: PASS.

- [ ] **Step 5: Update eventService.ts to use the converter**

Replace the full content of `packages/shared/src/services/eventService.ts` with:

```typescript
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
} from 'firebase/firestore';
import { db } from '../firebase';
import { eventConverter } from '../models/event/EventDataModel';
import type { EventData, EventDataInput, EventStatus } from '../models/event/EventDataModel';

function eventsCol() {
  return collection(db, 'events').withConverter(eventConverter);
}

export async function getEvent(eventId: string): Promise<(EventData & { id: string }) | null> {
  const snap = await getDoc(doc(db, 'events', eventId).withConverter(eventConverter));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
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
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createEvent(input: EventDataInput): Promise<string> {
  const newRef = doc(collection(db, 'events'));
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
  await updateDoc(doc(collection(db, 'events'), eventId), updates as any);
}

export async function updateEventStatus(eventId: string, status: EventStatus): Promise<void> {
  await updateDoc(doc(collection(db, 'events'), eventId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEvent(eventId: string): Promise<void> {
  await deleteDoc(doc(collection(db, 'events'), eventId));
}
```

- [ ] **Step 6: Update feedService.ts to use the converter**

Replace the full content of `packages/shared/src/services/feedService.ts` with:

```typescript
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
} from 'firebase/firestore';
import { db } from '../firebase';
import { eventConverter } from '../models/event/EventDataModel';
import type { EventData } from '../models/event/EventDataModel';

export interface FeedPage {
  events: (EventData & { id: string })[];
  cursor: QueryDocumentSnapshot<EventData> | null;
}

export async function getUpcomingFeed(
  pageSize: number = 20,
  cursor: QueryDocumentSnapshot<EventData> | null = null,
): Promise<FeedPage> {
  const eventsCol = collection(db, 'events').withConverter(eventConverter);
  const baseConstraints = [
    where('status', '==', 'published'),
    where('startDate', '>=', Timestamp.now()),
    orderBy('startDate', 'asc'),
    firestoreLimit(pageSize),
  ];
  const q = cursor
    ? query(eventsCol, ...baseConstraints, startAfter(cursor))
    : query(eventsCol, ...baseConstraints);

  const snap = await getDocs(q);
  const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { events, cursor: lastDoc };
}

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

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

export function filterByDistanceKm<T extends { villageCoordinates: GeoPoint }>(
  events: T[],
  reference: GeoPoint,
  maxKm: number,
): T[] {
  return events.filter((e) => haversineKm(reference, e.villageCoordinates) <= maxKm);
}
```

- [ ] **Step 7: Run tests + typecheck**

```bash
pnpm shared:test && pnpm shared:build
```

Expected: all tests pass, TypeScript compiles.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/models/event/EventDataModel.ts \
        packages/shared/src/services/eventService.ts \
        packages/shared/src/services/feedService.ts \
        packages/shared/test/models/converters.test.ts
git commit -m "feat(shared): add Firestore converters to event models; wire into services"
```

---

## Task 2: User + Persona domain converters

**Files:**
- Modify: `packages/shared/src/models/user/UserDataModel.ts`
- Modify: `packages/shared/src/models/user/PersonaDataModel.ts`
- Modify: `packages/shared/src/services/userService.ts`
- Modify: `packages/shared/src/services/personaService.ts`
- Modify: `packages/shared/test/models/converters.test.ts`

- [ ] **Step 1: Add converter tests for User and Persona**

Append to `packages/shared/test/models/converters.test.ts`:

```typescript
import { userConverter } from '../../src/models/user/UserDataModel';
import { personaConverter } from '../../src/models/user/PersonaDataModel';

describe('userConverter.fromFirestore', () => {
  it('converts birthday and createdAt Timestamps to Dates', () => {
    const birthday = new Date('1990-03-15T00:00:00Z');
    const created = new Date('2026-01-01T00:00:00Z');
    const snap = mockSnap('user-1', {
      displayName: 'Ana García',
      email: 'ana@example.com',
      birthday: Timestamp.fromDate(birthday),
      biography: null,
      telephone: null,
      photoURL: null,
      activeVillageId: 'v1',
      createdAt: Timestamp.fromDate(created),
    });
    const result = userConverter.fromFirestore(snap);
    expect(result.birthday).toEqual(birthday);
    expect(result.createdAt).toEqual(created);
    expect(result.displayName).toBe('Ana García');
  });
});

describe('personaConverter.fromFirestore', () => {
  it('converts birthday and createdAt Timestamps to Dates', () => {
    const birthday = new Date('2010-06-20T00:00:00Z');
    const created = new Date('2026-02-01T00:00:00Z');
    const snap = mockSnap('persona-1', {
      name: 'Juanito',
      birthday: Timestamp.fromDate(birthday),
      biography: null,
      photoURL: null,
      createdAt: Timestamp.fromDate(created),
    });
    const result = personaConverter.fromFirestore(snap);
    expect(result.birthday).toEqual(birthday);
    expect(result.createdAt).toEqual(created);
    expect(result.name).toBe('Juanito');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm shared:test
```

Expected: FAIL — `userConverter` and `personaConverter` not yet exported.

- [ ] **Step 3: Add `userConverter` to UserDataModel.ts**

Add this import at the top of `packages/shared/src/models/user/UserDataModel.ts`:
```typescript
import { Timestamp, type FirestoreDataConverter, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
```

Append at the bottom of the file:
```typescript
export const userConverter: FirestoreDataConverter<UserData> = {
  toFirestore: (data: UserData): DocumentData => ({
    displayName: data.displayName,
    email: data.email,
    birthday: Timestamp.fromDate(data.birthday),
    biography: data.biography,
    telephone: data.telephone,
    photoURL: data.photoURL,
    activeVillageId: data.activeVillageId,
    createdAt: Timestamp.fromDate(data.createdAt),
  }),
  fromFirestore: (snap: QueryDocumentSnapshot): UserData => {
    const d = snap.data();
    return buildUserData({
      displayName: d['displayName'] as string,
      email: d['email'] as string,
      birthday: (d['birthday'] as Timestamp).toDate(),
      biography: d['biography'] as string | null,
      telephone: d['telephone'] as string | null,
      photoURL: d['photoURL'] as string | null,
      activeVillageId: d['activeVillageId'] as string | null,
      createdAt: (d['createdAt'] as Timestamp).toDate(),
    });
  },
};
```

- [ ] **Step 4: Add `personaConverter` to PersonaDataModel.ts**

Add this import at the top of `packages/shared/src/models/user/PersonaDataModel.ts`:
```typescript
import { Timestamp, type FirestoreDataConverter, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
```

Append at the bottom of the file:
```typescript
export const personaConverter: FirestoreDataConverter<PersonaData> = {
  toFirestore: (data: PersonaData): DocumentData => ({
    name: data.name,
    birthday: Timestamp.fromDate(data.birthday),
    biography: data.biography,
    photoURL: data.photoURL,
    createdAt: Timestamp.fromDate(data.createdAt),
  }),
  fromFirestore: (snap: QueryDocumentSnapshot): PersonaData => {
    const d = snap.data();
    return buildPersonaData({
      name: d['name'] as string,
      birthday: (d['birthday'] as Timestamp).toDate(),
      biography: d['biography'] as string | null,
      photoURL: d['photoURL'] as string | null,
      createdAt: (d['createdAt'] as Timestamp).toDate(),
    });
  },
};
```

- [ ] **Step 5: Update userService.ts to use the converter**

Replace the full content of `packages/shared/src/services/userService.ts` with:

```typescript
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { userConverter } from '../models/user/UserDataModel';
import type { UserData, UserDataInput } from '../models/user/UserDataModel';

function usersCol() {
  return collection(db, 'users').withConverter(userConverter);
}

export async function getUserProfile(
  userId: string
): Promise<(UserData & { id: string }) | null> {
  const snap = await getDoc(doc(db, 'users', userId).withConverter(userConverter));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getAllUsers(): Promise<(UserData & { id: string })[]> {
  const q = query(usersCol(), orderBy('displayName', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createUserProfile(
  userId: string,
  input: UserDataInput
): Promise<void> {
  await setDoc(doc(db, 'users', userId), {
    displayName: input.displayName,
    email: input.email,
    birthday: Timestamp.fromDate(input.birthday),
    biography: input.biography ?? null,
    telephone: input.telephone ?? null,
    photoURL: input.photoURL ?? null,
    activeVillageId: input.activeVillageId ?? null,
    createdAt: serverTimestamp(),
  });
}

export async function updateUserProfile(
  userId: string,
  data: Partial<Pick<UserData, 'displayName' | 'biography' | 'telephone' | 'photoURL'>>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(db, 'users', userId), data as any);
}

export async function setActiveVillage(
  userId: string,
  villageId: string | null,
): Promise<void> {
  await updateDoc(doc(db, 'users', userId), { activeVillageId: villageId });
}
```

- [ ] **Step 6: Update personaService.ts to use the converter**

Replace the full content of `packages/shared/src/services/personaService.ts` with:

```typescript
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
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { personaConverter } from '../models/user/PersonaDataModel';
import type { PersonaData, PersonaDataInput } from '../models/user/PersonaDataModel';
import { MAX_PERSONAS_PER_USER } from '../models/user/PersonaDataModel';

function personasCol(userId: string) {
  return collection(db, 'users', userId, 'personas').withConverter(personaConverter);
}

export async function getPersonas(
  userId: string
): Promise<(PersonaData & { id: string })[]> {
  const q = query(personasCol(userId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getPersona(
  userId: string,
  personaId: string
): Promise<(PersonaData & { id: string }) | null> {
  const snap = await getDoc(doc(db, 'users', userId, 'personas', personaId).withConverter(personaConverter));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createPersona(
  userId: string,
  input: PersonaDataInput
): Promise<string> {
  const colRef = collection(db, 'users', userId, 'personas');
  const existing = await getDocs(colRef);
  if (existing.size >= MAX_PERSONAS_PER_USER) {
    throw new Error(`Cannot create more than ${MAX_PERSONAS_PER_USER} personas per user.`);
  }
  const newRef = doc(colRef);
  await setDoc(newRef, {
    name: input.name,
    birthday: Timestamp.fromDate(input.birthday),
    biography: input.biography ?? null,
    photoURL: input.photoURL ?? null,
    createdAt: serverTimestamp(),
  });
  return newRef.id;
}

export async function updatePersona(
  userId: string,
  personaId: string,
  data: Partial<Pick<PersonaData, 'name' | 'biography' | 'photoURL'>>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(db, 'users', userId, 'personas', personaId), data as any);
}

export async function deletePersona(
  userId: string,
  personaId: string
): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'personas', personaId));
}
```

- [ ] **Step 7: Run tests + typecheck**

```bash
pnpm shared:test && pnpm shared:build
```

Expected: all tests pass, no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/models/user/UserDataModel.ts \
        packages/shared/src/models/user/PersonaDataModel.ts \
        packages/shared/src/services/userService.ts \
        packages/shared/src/services/personaService.ts \
        packages/shared/test/models/converters.test.ts
git commit -m "feat(shared): add Firestore converters to user/persona models; wire into services"
```

---

## Task 3: Village domain converters

**Files:**
- Modify: `packages/shared/src/models/village/VillageDataModel.ts`
- Modify: `packages/shared/src/models/village/VillageMemberDataModel.ts`
- Modify: `packages/shared/src/models/village/InviteTokenDataModel.ts`
- Modify: `packages/shared/src/services/villageService.ts`
- Modify: `packages/shared/src/services/villageMemberService.ts`
- Modify: `packages/shared/src/services/inviteTokenService.ts`
- Modify: `packages/shared/test/models/converters.test.ts`

- [ ] **Step 1: Add converter tests for Village, VillageMember, InviteToken**

Append to `packages/shared/test/models/converters.test.ts`:

```typescript
import { GeoPoint as GP } from 'firebase/firestore';
import { villageConverter } from '../../src/models/village/VillageDataModel';
import { villageMemberConverter } from '../../src/models/village/VillageMemberDataModel';
import { inviteTokenConverter } from '../../src/models/village/InviteTokenDataModel';

describe('villageConverter.fromFirestore', () => {
  it('converts createdAt Timestamp to Date', () => {
    const created = new Date('2025-01-01T00:00:00Z');
    const snap = mockSnap('v1', {
      name: 'Becerril',
      description: 'Pueblo de Segovia',
      country: 'España',
      comunidadAutonoma: 'Castilla y León',
      provincia: 'Segovia',
      coordinates: new GP(41.0, -4.0),
      barrios: [],
      images: [],
      adminUserId: 'user-1',
      createdAt: Timestamp.fromDate(created),
    });
    const result = villageConverter.fromFirestore(snap);
    expect(result.createdAt).toEqual(created);
    expect(result.name).toBe('Becerril');
    expect(result.profileForm).toBeUndefined();
  });
});

describe('villageMemberConverter.fromFirestore', () => {
  it('converts joinedAt Timestamp; profileCompletedAt null stays null', () => {
    const joined = new Date('2026-03-01T00:00:00Z');
    const snap = mockSnap('user-1', {
      role: 'user',
      joinedAt: Timestamp.fromDate(joined),
      profileAnswers: {},
      profileCompletedAt: null,
    });
    const result = villageMemberConverter.fromFirestore(snap);
    expect(result.joinedAt).toEqual(joined);
    expect(result.profileCompletedAt).toBeNull();
    expect(result.role).toBe('user');
  });
});

describe('inviteTokenConverter.fromFirestore', () => {
  it('converts createdAt Timestamp; expiresAt null stays null', () => {
    const created = new Date('2026-04-01T00:00:00Z');
    const snap = mockSnap('token-1', {
      createdAt: Timestamp.fromDate(created),
      expiresAt: null,
      usageCount: 3,
    });
    const result = inviteTokenConverter.fromFirestore(snap);
    expect(result.createdAt).toEqual(created);
    expect(result.expiresAt).toBeNull();
    expect(result.usageCount).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm shared:test
```

Expected: FAIL — converters not yet exported.

- [ ] **Step 3: Add `villageConverter` to VillageDataModel.ts**

Add this import at the top:
```typescript
import { Timestamp, type FirestoreDataConverter, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
```

Note: remove the existing `GeoPoint` import if only used in types (it comes from firebase/firestore already); the existing file imports `GeoPoint` from `'firebase/firestore'` — merge into one import line.

The existing top of the file is:
```typescript
import { GeoPoint } from 'firebase/firestore';
import type { VillageProfileForm } from './CensoTypes';
```

Replace with:
```typescript
import { GeoPoint, Timestamp, type FirestoreDataConverter, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import type { VillageProfileForm, ProfileFormField } from './CensoTypes';
```

Append at the bottom of the file:

```typescript
function mapProfileForm(raw: unknown): VillageProfileForm | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as { fields?: ProfileFormField[]; updatedAt?: Timestamp };
  if (!Array.isArray(r.fields)) return undefined;
  return {
    fields: r.fields,
    updatedAt: r.updatedAt instanceof Timestamp ? r.updatedAt.toDate() : new Date(),
  };
}

export const villageConverter: FirestoreDataConverter<VillageData> = {
  toFirestore: (data: VillageData): DocumentData => ({
    name: data.name,
    description: data.description,
    country: data.country,
    comunidadAutonoma: data.comunidadAutonoma,
    provincia: data.provincia,
    coordinates: data.coordinates,
    barrios: data.barrios,
    images: data.images,
    adminUserId: data.adminUserId,
    createdAt: Timestamp.fromDate(data.createdAt),
  }),
  fromFirestore: (snap: QueryDocumentSnapshot): VillageData => {
    const d = snap.data();
    return {
      ...buildVillageData({
        name: d['name'] as string,
        description: d['description'] as string,
        country: (d['country'] as string) ?? 'España',
        comunidadAutonoma: d['comunidadAutonoma'] as string,
        provincia: d['provincia'] as string,
        coordinates: d['coordinates'] as GeoPoint,
        barrios: d['barrios'] as string[],
        images: d['images'] as string[],
        adminUserId: d['adminUserId'] as string,
        createdAt: (d['createdAt'] as Timestamp).toDate(),
      }),
      profileForm: mapProfileForm(d['profileForm']),
    };
  },
};
```

- [ ] **Step 4: Add `villageMemberConverter` to VillageMemberDataModel.ts**

Add this import at the top:
```typescript
import { Timestamp, type FirestoreDataConverter, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
```

Append at the bottom:
```typescript
export const villageMemberConverter: FirestoreDataConverter<VillageMemberData> = {
  toFirestore: (data: VillageMemberData): DocumentData => ({
    role: data.role,
    joinedAt: Timestamp.fromDate(data.joinedAt),
    profileAnswers: data.profileAnswers,
    profileCompletedAt: data.profileCompletedAt ? Timestamp.fromDate(data.profileCompletedAt) : null,
  }),
  fromFirestore: (snap: QueryDocumentSnapshot): VillageMemberData => {
    const d = snap.data();
    const completedAtRaw = d['profileCompletedAt'];
    return buildVillageMemberData({
      role: d['role'] as VillageMemberRole,
      joinedAt: (d['joinedAt'] as Timestamp).toDate(),
      profileAnswers: (d['profileAnswers'] as ProfileAnswers) ?? {},
      profileCompletedAt: completedAtRaw ? (completedAtRaw as Timestamp).toDate() : null,
    });
  },
};
```

- [ ] **Step 5: Add `inviteTokenConverter` to InviteTokenDataModel.ts**

Add this import at the top:
```typescript
import { Timestamp, type FirestoreDataConverter, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
```

Append at the bottom:
```typescript
export const inviteTokenConverter: FirestoreDataConverter<InviteTokenData> = {
  toFirestore: (data: InviteTokenData): DocumentData => ({
    createdAt: Timestamp.fromDate(data.createdAt),
    expiresAt: data.expiresAt ? Timestamp.fromDate(data.expiresAt) : null,
    usageCount: data.usageCount,
  }),
  fromFirestore: (snap: QueryDocumentSnapshot): InviteTokenData => {
    const d = snap.data();
    const expiresAtRaw = d['expiresAt'];
    return buildInviteTokenData({
      createdAt: (d['createdAt'] as Timestamp).toDate(),
      expiresAt: expiresAtRaw ? (expiresAtRaw as Timestamp).toDate() : null,
      usageCount: (d['usageCount'] as number) ?? 0,
    });
  },
};
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
pnpm shared:test
```

Expected: PASS.

- [ ] **Step 7: Update villageService.ts to use the converter**

Replace the full content of `packages/shared/src/services/villageService.ts` with:

```typescript
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
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { villageConverter } from '../models/village/VillageDataModel';
import type { VillageData, VillageDataInput } from '../models/village/VillageDataModel';

function villagesCol() {
  return collection(db, 'villages').withConverter(villageConverter);
}

export async function getVillage(
  villageId: string
): Promise<(VillageData & { id: string }) | null> {
  const snap = await getDoc(doc(db, 'villages', villageId).withConverter(villageConverter));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getVillages(): Promise<(VillageData & { id: string })[]> {
  const q = query(villagesCol(), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function generateVillageId(): string {
  return doc(collection(db, 'villages')).id;
}

export async function createVillage(
  input: VillageDataInput,
  villageId?: string,
): Promise<string> {
  const villageRef = villageId
    ? doc(db, 'villages', villageId)
    : doc(collection(db, 'villages'));
  const memberRef = doc(db, 'villages', villageRef.id, 'members', input.adminUserId);

  const batch = writeBatch(db);
  batch.set(villageRef, {
    name: input.name,
    description: input.description,
    country: input.country,
    comunidadAutonoma: input.comunidadAutonoma,
    provincia: input.provincia,
    coordinates: input.coordinates,
    barrios: input.barrios ?? [],
    images: input.images ?? [],
    adminUserId: input.adminUserId,
    createdAt: serverTimestamp(),
  });
  batch.set(memberRef, {
    userId: input.adminUserId,
    role: 'admin',
    joinedAt: serverTimestamp(),
    profileAnswers: {},
    profileCompletedAt: null,
  });
  await batch.commit();
  return villageRef.id;
}

export async function updateVillage(
  villageId: string,
  data: Partial<Omit<VillageData, 'createdAt' | 'profileForm'>>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(db, 'villages', villageId), data as any);
}

export async function deleteVillage(villageId: string): Promise<void> {
  await deleteDoc(doc(db, 'villages', villageId));
}
```

- [ ] **Step 8: Update villageMemberService.ts to use the converter**

Replace the full content of `packages/shared/src/services/villageMemberService.ts` with:

```typescript
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  where,
  query,
} from 'firebase/firestore';
import { db } from '../firebase';
import { villageMemberConverter } from '../models/village/VillageMemberDataModel';
import type { VillageMemberData, VillageMemberRole } from '../models/village/VillageMemberDataModel';
import type { ProfileAnswers } from '../models/village/CensoTypes';

function membersCol(villageId: string) {
  return collection(db, 'villages', villageId, 'members').withConverter(villageMemberConverter);
}

export async function getVillageMember(
  villageId: string,
  userId: string
): Promise<(VillageMemberData & { id: string }) | null> {
  const snap = await getDoc(doc(db, 'villages', villageId, 'members', userId).withConverter(villageMemberConverter));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getVillageMembers(
  villageId: string
): Promise<(VillageMemberData & { id: string })[]> {
  const snap = await getDocs(membersCol(villageId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addVillageMember(
  villageId: string,
  userId: string,
  role: VillageMemberRole = 'user'
): Promise<void> {
  await setDoc(doc(db, 'villages', villageId, 'members', userId), {
    userId,
    role,
    joinedAt: serverTimestamp(),
    profileAnswers: {},
    profileCompletedAt: null,
  });
}

export async function removeVillageMember(
  villageId: string,
  userId: string
): Promise<void> {
  await deleteDoc(doc(db, 'villages', villageId, 'members', userId));
}

export async function isVillageMember(
  villageId: string,
  userId: string
): Promise<boolean> {
  const snap = await getDoc(doc(db, 'villages', villageId, 'members', userId));
  return snap.exists();
}

export async function isVillageAdmin(
  villageId: string,
  userId: string
): Promise<boolean> {
  const snap = await getDoc(doc(db, 'villages', villageId, 'members', userId));
  if (!snap.exists()) return false;
  return snap.data()['role'] === 'admin';
}

export interface UserMembership {
  villageId: string;
  role: VillageMemberRole;
  joinedAt: Date;
}

export async function getUserMemberships(userId: string): Promise<UserMembership[]> {
  const q = query(collectionGroup(db, 'members'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs
    .filter((d) => d.ref.parent.parent?.parent.id === 'villages')
    .map((d) => {
      const data = d.data();
      return {
        villageId: d.ref.parent.parent!.id,
        role: data['role'] as VillageMemberRole,
        joinedAt: (data['joinedAt'] as Timestamp).toDate(),
      };
    });
}
```

- [ ] **Step 9: Update inviteTokenService.ts to use the converter**

Replace the full content of `packages/shared/src/services/inviteTokenService.ts` with:

```typescript
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { inviteTokenConverter } from '../models/village/InviteTokenDataModel';
import { isTokenExpired } from '../models/village/InviteTokenDataModel';
import type { InviteTokenData } from '../models/village/InviteTokenDataModel';

function tokensCol(villageId: string) {
  return collection(db, 'villages', villageId, 'inviteTokens').withConverter(inviteTokenConverter);
}

export async function createInviteToken(
  villageId: string,
  expiresAt?: Date | null
): Promise<string> {
  const newRef = doc(collection(db, 'villages', villageId, 'inviteTokens'));
  await setDoc(newRef, {
    createdAt: serverTimestamp(),
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
    usageCount: 0,
  });
  return newRef.id;
}

export async function validateInviteToken(
  villageId: string,
  tokenId: string
): Promise<boolean> {
  const snap = await getDoc(doc(db, 'villages', villageId, 'inviteTokens', tokenId).withConverter(inviteTokenConverter));
  if (!snap.exists()) return false;
  return !isTokenExpired(snap.data());
}

export async function consumeInviteToken(
  villageId: string,
  tokenId: string
): Promise<void> {
  await updateDoc(doc(db, 'villages', villageId, 'inviteTokens', tokenId), {
    usageCount: increment(1),
  });
}

export async function getInviteTokens(
  villageId: string
): Promise<(InviteTokenData & { id: string })[]> {
  const snap = await getDocs(tokensCol(villageId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteInviteToken(
  villageId: string,
  tokenId: string
): Promise<void> {
  await deleteDoc(doc(db, 'villages', villageId, 'inviteTokens', tokenId));
}

export interface AcceptInviteProfile {
  displayName: string;
  email: string;
  birthday: Date;
  photoURL?: string | null;
}

export interface AcceptInviteResult {
  villageId: string;
  alreadyMember: boolean;
  profileCreated: boolean;
}

export async function acceptInvite(
  villageId: string,
  tokenId: string,
  profile?: AcceptInviteProfile,
): Promise<AcceptInviteResult> {
  const callable = httpsCallable<
    {
      villageId: string;
      tokenId: string;
      profile?: {
        displayName: string;
        email: string;
        birthday: string;
        photoURL: string | null;
      };
    },
    AcceptInviteResult
  >(functions, 'acceptInvite');

  const payload = profile
    ? {
        villageId,
        tokenId,
        profile: {
          displayName: profile.displayName,
          email: profile.email,
          birthday: profile.birthday.toISOString().slice(0, 10),
          photoURL: profile.photoURL ?? null,
        },
      }
    : { villageId, tokenId };

  const result = await callable(payload);
  return result.data;
}
```

- [ ] **Step 10: Run tests + typecheck**

```bash
pnpm shared:test && pnpm shared:build
```

Expected: all tests pass, no TypeScript errors.

- [ ] **Step 11: Commit**

```bash
git add packages/shared/src/models/village/ \
        packages/shared/src/services/villageService.ts \
        packages/shared/src/services/villageMemberService.ts \
        packages/shared/src/services/inviteTokenService.ts \
        packages/shared/test/models/converters.test.ts
git commit -m "feat(shared): add Firestore converters to village models; wire into services"
```

---

## Task 4: Organization domain converters

**Files:**
- Modify: `packages/shared/src/models/organization/OrganizationDataModel.ts`
- Modify: `packages/shared/src/models/organization/OrgMemberDataModel.ts`
- Modify: `packages/shared/src/services/organizationService.ts`
- Modify: `packages/shared/src/services/orgMemberService.ts`
- Modify: `packages/shared/test/models/converters.test.ts`

- [ ] **Step 1: Add converter tests**

Append to `packages/shared/test/models/converters.test.ts`:

```typescript
import { organizationConverter } from '../../src/models/organization/OrganizationDataModel';
import { orgMemberConverter } from '../../src/models/organization/OrgMemberDataModel';

describe('organizationConverter.fromFirestore', () => {
  it('converts createdAt and null decidedAt', () => {
    const created = new Date('2026-01-15T00:00:00Z');
    const snap = mockSnap('org-1', {
      name: 'Peña Los Valientes',
      description: null,
      type: 'peña',
      status: 'pending',
      villageId: 'v1',
      requestedBy: 'user-1',
      approvedBy: null,
      createdAt: Timestamp.fromDate(created),
      decidedAt: null,
    });
    const result = organizationConverter.fromFirestore(snap);
    expect(result.createdAt).toEqual(created);
    expect(result.decidedAt).toBeNull();
    expect(result.name).toBe('Peña Los Valientes');
  });
});

describe('orgMemberConverter.fromFirestore', () => {
  it('converts joinedAt Timestamp to Date', () => {
    const joined = new Date('2026-02-10T00:00:00Z');
    const snap = mockSnap('user-1', {
      joinedAt: Timestamp.fromDate(joined),
    });
    const result = orgMemberConverter.fromFirestore(snap);
    expect(result.joinedAt).toEqual(joined);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm shared:test
```

Expected: FAIL.

- [ ] **Step 3: Add `organizationConverter` to OrganizationDataModel.ts**

Add this import at the top of the file:
```typescript
import { Timestamp, type FirestoreDataConverter, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
```

Append at the bottom:
```typescript
export const organizationConverter: FirestoreDataConverter<OrganizationData> = {
  toFirestore: (data: OrganizationData): DocumentData => ({
    name: data.name,
    description: data.description,
    type: data.type,
    status: data.status,
    villageId: data.villageId,
    requestedBy: data.requestedBy,
    approvedBy: data.approvedBy,
    createdAt: Timestamp.fromDate(data.createdAt),
    decidedAt: data.decidedAt ? Timestamp.fromDate(data.decidedAt) : null,
  }),
  fromFirestore: (snap: QueryDocumentSnapshot): OrganizationData => {
    const d = snap.data();
    const decidedAtRaw = d['decidedAt'];
    return buildOrganizationData({
      name: d['name'] as string,
      description: d['description'] as string | null,
      type: d['type'] as OrganizationType,
      status: d['status'] as OrganizationStatus,
      villageId: d['villageId'] as string,
      requestedBy: d['requestedBy'] as string,
      approvedBy: d['approvedBy'] as string | null,
      createdAt: (d['createdAt'] as Timestamp).toDate(),
      decidedAt: decidedAtRaw ? (decidedAtRaw as Timestamp).toDate() : null,
    });
  },
};
```

- [ ] **Step 4: Add `orgMemberConverter` to OrgMemberDataModel.ts**

Add this import at the top:
```typescript
import { Timestamp, type FirestoreDataConverter, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
```

Append at the bottom:
```typescript
export const orgMemberConverter: FirestoreDataConverter<OrgMemberData> = {
  toFirestore: (data: OrgMemberData): DocumentData => ({
    joinedAt: Timestamp.fromDate(data.joinedAt),
  }),
  fromFirestore: (snap: QueryDocumentSnapshot): OrgMemberData => {
    const d = snap.data();
    return buildOrgMemberData({
      joinedAt: (d['joinedAt'] as Timestamp).toDate(),
    });
  },
};
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm shared:test
```

Expected: PASS.

- [ ] **Step 6: Update organizationService.ts to use the converter**

Replace the full content of `packages/shared/src/services/organizationService.ts` with:

```typescript
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
} from 'firebase/firestore';
import { db } from '../firebase';
import { organizationConverter } from '../models/organization/OrganizationDataModel';
import type {
  OrganizationData,
  OrganizationDataInput,
  OrganizationStatus,
} from '../models/organization/OrganizationDataModel';

function orgsCol() {
  return collection(db, 'organizations').withConverter(organizationConverter);
}

export async function getOrganization(orgId: string): Promise<(OrganizationData & { id: string }) | null> {
  const snap = await getDoc(doc(db, 'organizations', orgId).withConverter(organizationConverter));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getOrganizationsByVillage(
  villageId: string,
  status?: OrganizationStatus
): Promise<(OrganizationData & { id: string })[]> {
  const constraints = status
    ? [where('villageId', '==', villageId), where('status', '==', status), orderBy('name', 'asc')]
    : [where('villageId', '==', villageId), orderBy('name', 'asc')];
  const q = query(orgsCol(), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function requestOrganization(input: OrganizationDataInput): Promise<string> {
  const newRef = doc(collection(db, 'organizations'));
  await setDoc(newRef, {
    name: input.name,
    description: input.description ?? null,
    type: input.type,
    status: 'pending',
    villageId: input.villageId,
    requestedBy: input.requestedBy,
    approvedBy: null,
    createdAt: serverTimestamp(),
    decidedAt: null,
  });
  return newRef.id;
}

export async function approveOrganization(orgId: string, approvedBy: string): Promise<void> {
  await updateDoc(doc(db, 'organizations', orgId), {
    status: 'approved',
    approvedBy,
    decidedAt: serverTimestamp(),
  });
}

export async function rejectOrganization(orgId: string): Promise<void> {
  await updateDoc(doc(db, 'organizations', orgId), {
    status: 'rejected',
    approvedBy: null,
    decidedAt: serverTimestamp(),
  });
}

export async function updateOrganization(
  orgId: string,
  data: Partial<Omit<OrganizationData, 'createdAt' | 'requestedBy' | 'villageId'>>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(db, 'organizations', orgId), data as any);
}

export async function deleteOrganization(orgId: string): Promise<void> {
  await deleteDoc(doc(db, 'organizations', orgId));
}
```

- [ ] **Step 7: Update orgMemberService.ts to use the converter**

Replace the full content of `packages/shared/src/services/orgMemberService.ts` with:

```typescript
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { orgMemberConverter } from '../models/organization/OrgMemberDataModel';
import type { OrgMemberData } from '../models/organization/OrgMemberDataModel';

function orgMembersCol(orgId: string) {
  return collection(db, 'organizations', orgId, 'members').withConverter(orgMemberConverter);
}

export async function getOrgMembers(orgId: string): Promise<(OrgMemberData & { id: string })[]> {
  const snap = await getDocs(orgMembersCol(orgId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addOrgMember(orgId: string, userId: string): Promise<void> {
  await setDoc(doc(db, 'organizations', orgId, 'members', userId), {
    joinedAt: serverTimestamp(),
  });
}

export async function removeOrgMember(orgId: string, userId: string): Promise<void> {
  await deleteDoc(doc(db, 'organizations', orgId, 'members', userId));
}

export async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'organizations', orgId, 'members', userId));
  return snap.exists();
}
```

- [ ] **Step 8: Run tests + typecheck**

```bash
pnpm shared:test && pnpm shared:build
```

Expected: all tests pass, no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/models/organization/ \
        packages/shared/src/services/organizationService.ts \
        packages/shared/src/services/orgMemberService.ts \
        packages/shared/test/models/converters.test.ts
git commit -m "feat(shared): add Firestore converters to organization models; wire into services"
```

---

## Task 5: Notification + Registration converters

**Files:**
- Modify: `packages/shared/src/models/notification/NotificationDataModel.ts`
- Modify: `packages/shared/src/models/event/RegistrationDataModel.ts`
- Modify: `packages/shared/src/services/notificationService.ts`
- Modify: `packages/shared/src/services/registrationService.ts`
- Modify: `packages/shared/test/models/converters.test.ts`

- [ ] **Step 1: Add converter tests**

Append to `packages/shared/test/models/converters.test.ts`:

```typescript
import { notificationConverter } from '../../src/models/notification/NotificationDataModel';
import { registrationConverter } from '../../src/models/event/RegistrationDataModel';

describe('notificationConverter.fromFirestore', () => {
  it('converts createdAt Timestamp to Date', () => {
    const created = new Date('2026-04-20T00:00:00Z');
    const snap = mockSnap('notif-1', {
      type: 'org_approved',
      title: 'Organización aprobada',
      body: 'Tu organización ha sido aprobada.',
      eventId: null,
      villageId: 'v1',
      read: false,
      createdAt: Timestamp.fromDate(created),
    });
    const result = notificationConverter.fromFirestore(snap);
    expect(result.createdAt).toEqual(created);
    expect(result.type).toBe('org_approved');
    expect(result.read).toBe(false);
  });
});

describe('registrationConverter.fromFirestore', () => {
  it('converts registeredAt Timestamp to Date', () => {
    const registered = new Date('2026-07-01T10:00:00Z');
    const snap = mockSnap('reg-1', {
      userId: 'user-1',
      personaId: null,
      name: 'Ana García',
      status: 'confirmed',
      position: 1,
      registeredAt: Timestamp.fromDate(registered),
    });
    const result = registrationConverter.fromFirestore(snap);
    expect(result.registeredAt).toEqual(registered);
    expect(result.status).toBe('confirmed');
    expect(result.position).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm shared:test
```

Expected: FAIL.

- [ ] **Step 3: Add `notificationConverter` to NotificationDataModel.ts**

Add this import at the top:
```typescript
import { Timestamp, type FirestoreDataConverter, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
```

Append at the bottom:
```typescript
export const notificationConverter: FirestoreDataConverter<NotificationData> = {
  toFirestore: (data: NotificationData): DocumentData => ({
    type: data.type,
    title: data.title,
    body: data.body,
    eventId: data.eventId,
    villageId: data.villageId,
    read: data.read,
    createdAt: Timestamp.fromDate(data.createdAt),
  }),
  fromFirestore: (snap: QueryDocumentSnapshot): NotificationData => {
    const d = snap.data();
    return buildNotificationData({
      type: d['type'] as NotificationType,
      title: d['title'] as string,
      body: d['body'] as string,
      eventId: d['eventId'] as string | null,
      villageId: d['villageId'] as string | null,
      read: d['read'] as boolean,
      createdAt: (d['createdAt'] as Timestamp).toDate(),
    });
  },
};
```

- [ ] **Step 4: Add `registrationConverter` to RegistrationDataModel.ts**

Add this import at the top:
```typescript
import { Timestamp, type FirestoreDataConverter, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
```

Append at the bottom:
```typescript
export const registrationConverter: FirestoreDataConverter<RegistrationData> = {
  toFirestore: (data: RegistrationData): DocumentData => ({
    userId: data.userId,
    personaId: data.personaId,
    name: data.name,
    status: data.status,
    position: data.position,
    registeredAt: Timestamp.fromDate(data.registeredAt),
  }),
  fromFirestore: (snap: QueryDocumentSnapshot): RegistrationData => {
    const d = snap.data();
    return buildRegistrationData({
      userId: d['userId'] as string,
      personaId: d['personaId'] as string | null,
      name: d['name'] as string,
      status: d['status'] as RegistrationStatus,
      position: d['position'] as number,
      registeredAt: (d['registeredAt'] as Timestamp).toDate(),
    });
  },
};
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm shared:test
```

Expected: PASS.

- [ ] **Step 6: Update notificationService.ts to use the converter**

Replace the full content of `packages/shared/src/services/notificationService.ts` with:

```typescript
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  where,
  limit,
  writeBatch,
  serverTimestamp,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '../firebase';
import { notificationConverter } from '../models/notification/NotificationDataModel';
import type { NotificationData, NotificationDataInput } from '../models/notification/NotificationDataModel';

function notificationsCol(userId: string) {
  return collection(db, 'users', userId, 'notifications').withConverter(notificationConverter);
}

export async function getNotifications(
  userId: string,
  maxResults = 50
): Promise<(NotificationData & { id: string })[]> {
  const q = query(
    notificationsCol(userId),
    orderBy('createdAt', 'desc'),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getUnreadCount(userId: string): Promise<number> {
  const q = query(notificationsCol(userId), where('read', '==', false));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export async function createNotification(
  userId: string,
  input: NotificationDataInput
): Promise<string> {
  const newRef = doc(collection(db, 'users', userId, 'notifications'));
  await setDoc(newRef, {
    type: input.type,
    title: input.title,
    body: input.body,
    eventId: input.eventId ?? null,
    villageId: input.villageId ?? null,
    read: input.read ?? false,
    createdAt: serverTimestamp(),
  });
  return newRef.id;
}

export async function markAsRead(
  userId: string,
  notificationId: string
): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), { read: true });
}

export async function markAllAsRead(userId: string): Promise<void> {
  const q = query(notificationsCol(userId), where('read', '==', false));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { read: true });
  });
  await batch.commit();
}
```

- [ ] **Step 7: Update registrationService.ts to use the converter**

Replace the full content of `packages/shared/src/services/registrationService.ts` with:

```typescript
import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
  collectionGroup,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '../firebase';
import { registrationConverter } from '../models/event/RegistrationDataModel';
import type { RegistrationData, RegistrationStatus } from '../models/event/RegistrationDataModel';

export interface RegisterInput {
  userId: string;
  personaId: string | null;
  name: string;
}

function regsCol(eventId: string) {
  return collection(db, 'events', eventId, 'registrations').withConverter(registrationConverter);
}

export function determineRegistrationStatus(
  maxAttendees: number | null,
  currentConfirmedCount: number
): RegistrationStatus {
  if (maxAttendees === null) return 'confirmed';
  return currentConfirmedCount < maxAttendees ? 'confirmed' : 'waitlisted';
}

export async function getEventRegistrations(
  eventId: string
): Promise<(RegistrationData & { id: string })[]> {
  const q = query(regsCol(eventId), orderBy('position', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getConfirmedCount(eventId: string): Promise<number> {
  const q = query(regsCol(eventId), where('status', '==', 'confirmed'));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export async function getTotalCount(eventId: string): Promise<number> {
  const snap = await getCountFromServer(regsCol(eventId));
  return snap.data().count;
}

export async function getUserRegistrations(
  eventId: string,
  userId: string
): Promise<(RegistrationData & { id: string })[]> {
  const q = query(regsCol(eventId), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function registerToEvent(
  eventId: string,
  inputs: RegisterInput[],
  maxAttendees: number | null
): Promise<void> {
  const confirmedCount = await getConfirmedCount(eventId);
  const totalCount = await getTotalCount(eventId);

  const batch = writeBatch(db);
  inputs.forEach((input, i) => {
    const newRef = doc(collection(db, 'events', eventId, 'registrations'));
    const position = totalCount + i + 1;
    const status = determineRegistrationStatus(maxAttendees, confirmedCount + i);
    batch.set(newRef, {
      userId: input.userId,
      personaId: input.personaId ?? null,
      name: input.name,
      status,
      position,
      registeredAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function cancelRegistration(eventId: string, regId: string): Promise<void> {
  await deleteDoc(doc(db, 'events', eventId, 'registrations', regId));
}

export async function getUserRegistrationsAcrossEvents(
  userId: string
): Promise<(RegistrationData & { id: string; eventPath: string })[]> {
  const q = query(
    collectionGroup(db, 'registrations'),
    where('userId', '==', userId),
    orderBy('registeredAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const pathSegments = d.ref.path.split('/');
    const eventPath = pathSegments.slice(0, 2).join('/');
    return {
      id: d.id,
      userId: data['userId'] as string,
      personaId: (data['personaId'] as string | null) ?? null,
      name: data['name'] as string,
      status: data['status'] as RegistrationStatus,
      position: data['position'] as number,
      registeredAt: (data['registeredAt'] as Timestamp).toDate(),
      eventPath,
    };
  });
}
```

- [ ] **Step 8: Run tests + typecheck**

```bash
pnpm shared:test && pnpm shared:build
```

Expected: all tests pass, no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/models/notification/NotificationDataModel.ts \
        packages/shared/src/models/event/RegistrationDataModel.ts \
        packages/shared/src/services/notificationService.ts \
        packages/shared/src/services/registrationService.ts \
        packages/shared/test/models/converters.test.ts
git commit -m "feat(shared): add Firestore converters to notification/registration models; wire into services"
```

---

## Task 6: CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Create CLAUDE.md at the repo root**

Create `/home/powervaro/githubs/cultuvilla/CLAUDE.md` with this content:

```markdown
# Cultuvilla — Claude Notes

Community events platform for Spanish villages. pnpm monorepo, Next.js 15 web app, Firebase backend.

## Layout
- `apps/web/` — Next.js 15 + React 19 + Tailwind 4 + next-intl. TypeScript.
- `packages/shared/` — `@cultuvilla/shared`: models, services, firebase. **TypeScript, vitest.**
- `functions/` — Firebase Cloud Functions (Node, TypeScript).
- `docs/superpowers/specs/` — design docs, named `YYYY-MM-DD-<slug>.md`.
- `docs/superpowers/plans/` — implementation plans for in-flight work.

## Agent-first
This repo is designed for agents to read and modify. Lean on strict types, descriptive names, and converters. Skip ceremony docs — per-function API references go stale and grep is more reliable. Add a comment only when something can't be derived from types or names: side effects, preconditions, subtle invariants.

## Core rules
1. **Models are source of truth.** Reuse interfaces from `packages/shared/src/models/` before defining new shapes. Data crossing service/component/hook boundaries must match a model.
2. **Converters are the type boundary.** Every model file exports a `FirestoreDataConverter`. Services apply `.withConverter()` on collection/doc refs for reads. Write paths (setDoc/updateDoc with serverTimestamp()) do not go through the converter.
3. **No retrocompat shims** unless explicitly asked. When changing data shape, call out that existing data needs migration.
4. **Avoid silent fallbacks.** Prefer explicit errors over defaults that mask bugs.
5. **Reuse first.** Check `packages/shared/src/{services,utils}` and `apps/web/{components,hooks}` before writing new code.

## Don't
- **Never start dev servers** (`pnpm web:dev`, emulators) — the user runs these.
- Don't add comments that restate what the code does.
- Don't bypass hooks (`--no-verify`) or amend commits unless asked.
- Don't deploy Firebase to production without explicit confirmation.

## Tests
- **Shared package (vitest):** `pnpm shared:test` — full suite.
- **Typecheck:** `pnpm shared:build` (shared), `pnpm web:build` (web).
- Tests live under `packages/shared/test/{models,services}/` mirroring `src/`.

## Backend boundaries
- Writes the client cannot make under Firestore rules belong in **Cloud Functions** (`functions/`): cross-user writes, trust-sensitive state, atomic multi-doc updates.
- Keep writes client-side when rules already permit them.
- **Services are the only place Firebase modular SDK is imported in client code.** Components, hooks, and pages must go through `packages/shared/src/services/`.
- **Validation lives in the service function, not the UI.** Hiding a button is UX optimization; the service must still refuse invalid calls.

## Firestore
- When adding/changing queries, update `firestore.indexes.json` and mention deployment.
- Rules in `firestore.rules`. Deploy: `firebase deploy --only firestore:rules` — confirm before running.

## Conventions
- TypeScript everywhere. Explicit types on exports.
- Functional components, default export.
- Commits: conventional (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`). Concise subject, "why" in body when non-obvious.
- Specs go in `docs/superpowers/specs/`; in-progress plans in `docs/superpowers/plans/`.

## Tooling
- Package manager: **pnpm 10.24** (workspace via `pnpm-workspace.yaml`). Always `pnpm`, never `npm` or `yarn`.
- Firebase v11 modular SDK in client; admin SDK in `functions/`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with agent-first codebase guidelines"
```

---

## Task 7: ESLint + lint-staged + husky

**Files:**
- Create: `apps/web/eslint.config.mjs`
- Create: `packages/shared/eslint.config.mjs`
- Modify: `package.json` (root) — add lint-staged config + scripts
- Create: `.husky/pre-commit`

- [ ] **Step 1: Install ESLint dependencies**

```bash
cd /home/powervaro/githubs/cultuvilla && pnpm add -D -w husky lint-staged
pnpm add -D --filter cultuvilla-web @typescript-eslint/parser @typescript-eslint/eslint-plugin unused-imports eslint-plugin-unused-imports
pnpm add -D --filter @cultuvilla/shared eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-unused-imports
```

- [ ] **Step 2: Create apps/web/eslint.config.mjs**

```javascript
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import unusedImports from 'eslint-plugin-unused-imports';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': ['warn', { checksVoidReturn: false }],
      'unused-imports/no-unused-imports': 'warn',
    },
  },
  {
    ignores: ['.next/', 'node_modules/'],
  },
];
```

- [ ] **Step 3: Create packages/shared/eslint.config.mjs**

```javascript
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': ['warn', { checksVoidReturn: false }],
      'unused-imports/no-unused-imports': 'warn',
    },
  },
  {
    ignores: ['dist/', 'node_modules/'],
  },
];
```

- [ ] **Step 4: Add lint script to packages/shared/package.json**

In `packages/shared/package.json`, add to the `scripts` object:
```json
"lint": "eslint src --max-warnings 0",
"lint:fix": "eslint src --fix --max-warnings 0"
```

- [ ] **Step 5: Configure husky and lint-staged in root package.json**

In the root `package.json`, add to `scripts`:
```json
"prepare": "husky"
```

Add a top-level `lint-staged` key:
```json
"lint-staged": {
  "apps/web/**/*.{ts,tsx}": "pnpm --filter cultuvilla-web exec eslint --fix --no-warn-ignored --max-warnings 0",
  "packages/shared/src/**/*.ts": "pnpm --filter @cultuvilla/shared exec eslint --fix --no-warn-ignored --max-warnings 0"
}
```

- [ ] **Step 6: Initialize husky and create pre-commit hook**

```bash
cd /home/powervaro/githubs/cultuvilla && pnpm exec husky init
```

Replace the generated `.husky/pre-commit` content with:
```sh
pnpm exec lint-staged
```

- [ ] **Step 7: Verify lint runs cleanly**

```bash
pnpm --filter cultuvilla-web exec eslint apps/web --max-warnings 0
pnpm --filter @cultuvilla/shared exec eslint packages/shared/src --max-warnings 0
```

Fix any warnings that appear. Common expected ones after adding converters:
- `@typescript-eslint/no-explicit-any` in update functions — these already have `// eslint-disable-next-line` comments; that's fine to leave.

- [ ] **Step 8: Commit**

```bash
git add apps/web/eslint.config.mjs \
        packages/shared/eslint.config.mjs \
        packages/shared/package.json \
        package.json \
        .husky/pre-commit \
        pnpm-lock.yaml
git commit -m "chore: add ESLint configs and husky pre-commit lint-staged hook"
```

---

## Self-review

**Spec coverage:**
- ✅ Firestore converters on all 10 model files (Event, User, Persona, Village, VillageMember, InviteToken, Organization, OrgMember, Notification, Registration)
- ✅ All `mapXDoc` functions removed from services; replaced with `.withConverter()` reads
- ✅ `feedService.ts` updated — `mapEventDoc` import removed, cursor type updated to `QueryDocumentSnapshot<EventData>`
- ✅ Write paths unchanged (serverTimestamp() still works)
- ✅ `getUserRegistrationsAcrossEvents` — uses `collectionGroup` without converter (manual map retained) because it adds the `eventPath` field not in the model
- ✅ `getUserMemberships` — uses `collectionGroup` without converter (returns `UserMembership`, not `VillageMemberData`)
- ✅ CLAUDE.md written and adapted for villa-events
- ✅ ESLint flat config for both `apps/web` and `packages/shared`
- ✅ husky + lint-staged on pre-commit

**No placeholders:** All steps contain actual code.

**Type consistency:** `buildVillageData` returns `VillageData` which does not include `profileForm`; the converter spreads the result and adds `profileForm` separately — consistent with the interface which has `profileForm?` as optional.
