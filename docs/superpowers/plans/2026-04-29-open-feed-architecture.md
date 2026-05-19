# Open Feed Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate from village-nested events/organizations to top-level collections, replace the village-as-home routing with a global chronological feed, demote `activeVillageId` to a UI hint, and keep membership semantics meaningful (censo + visibility + org creation).

**Architecture:** Big-bang migration. Update shared models + services for the new shape, write a one-shot migration script, deploy new rules/indexes/Cloud Function trigger, then swap the web routes and home page. Members stay nested under villages; registrations stay nested under events. Events and organizations move to top-level collections with `villageId` fields and (for events) denormalized village display fields kept in sync by a Cloud Function trigger.

**Tech Stack:** TypeScript, pnpm workspaces, Firebase (Firestore, Storage, Cloud Functions v2), Next.js 15 / React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-29-open-feed-architecture-design.md`

---

## File Structure

### Modified

```
packages/shared/src/models/event/EventDataModel.ts          ← add village denorm fields
packages/shared/src/models/organization/OrganizationDataModel.ts ← add villageId, approvedBy, decidedAt
packages/shared/src/services/eventService.ts                ← top-level events
packages/shared/src/services/organizationService.ts         ← top-level orgs
packages/shared/src/services/orgMemberService.ts            ← drop villageId arg
packages/shared/src/services/registrationService.ts         ← top-level event paths
packages/shared/src/services/index.ts                       ← (re-exports unchanged)

functions/src/index.ts                                      ← register new trigger
firestore.rules                                             ← top-level events/orgs
firestore.indexes.json                                      ← drop nested exemptions, add flat indexes

apps/web/app/page.tsx                                       ← replace with feed
apps/web/app/village/[id]/page.tsx                          ← reframe as info page
apps/web/app/profile/page.tsx                               ← Mis pueblos list
apps/web/app/my-signups/page.tsx                            ← parse new eventPath shape
apps/web/components/common/BottomNav.tsx                    ← drop village-aware framing
apps/web/contexts/VillageContext.tsx                        ← (review for breakage)
apps/web/hooks/useRegistrations.ts                          ← drop villageId arg

packages/shared/test/models/EventDataModel.test.ts          ← extend
packages/shared/test/services/registrationService.test.ts   ← extend
```

### Created

```
packages/shared/src/services/feedService.ts                 ← feed query + haversine
functions/src/syncVillageDenormalization.ts                 ← onUpdate trigger
scripts/migrate-to-flat.mjs                                 ← one-shot migration
apps/web/app/event/[eventId]/page.tsx                       ← event detail at flat path
apps/web/app/org/[orgId]/page.tsx                           ← org page
apps/web/app/org/[orgId]/events/new/page.tsx                ← create event
apps/web/app/org/[orgId]/events/[eventId]/edit/page.tsx     ← edit event
apps/web/components/event/AttendeeBadge.tsx                 ← Vecino/Visitante badge
apps/web/components/feed/FeedCard.tsx                       ← feed event card
apps/web/components/feed/FeedFilterBar.tsx                  ← chronological / Cerca de mí toggle

packages/shared/test/services/feedService.test.ts
packages/shared/test/services/feedHaversine.test.ts
```

### Deleted (after migration verified)

```
apps/web/app/village/[id]/event/                            ← whole subtree
apps/web/app/village/[id]/org/                              ← whole subtree
```

---

## Phase 1 — Shared Models

### Task 1: Add village denormalized fields to `EventDataModel`

**Files:**
- Modify: `packages/shared/src/models/event/EventDataModel.ts`
- Test: `packages/shared/test/models/EventDataModel.test.ts`

- [ ] **Step 1: Read existing tests to confirm baseline**

Run: `pnpm --filter @cultuvilla/shared test -- EventDataModel`
Expected: PASS (existing tests should be green before changing).

- [ ] **Step 2: Write failing test for new denormalized fields**

Add to `packages/shared/test/models/EventDataModel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { GeoPoint } from 'firebase/firestore';
import { buildEventData } from '../../src/models/event/EventDataModel';

describe('EventDataModel — village denormalization', () => {
  it('stores villageId, villageName, villageCoverImage, villageCoordinates', () => {
    const coords = new GeoPoint(40.5, -4.0);
    const event = buildEventData({
      title: 't',
      description: 'd',
      startDate: new Date('2026-05-01'),
      location: { type: 'text', coordinates: null, text: 'plaza' },
      organizationId: 'org1',
      organizationName: 'Org 1',
      createdBy: 'u1',
      villageId: 'v1',
      villageName: 'Becerril',
      villageCoverImage: 'https://example/cover.jpg',
      villageCoordinates: coords,
    });
    expect(event.villageId).toBe('v1');
    expect(event.villageName).toBe('Becerril');
    expect(event.villageCoverImage).toBe('https://example/cover.jpg');
    expect(event.villageCoordinates).toBe(coords);
  });

  it('allows villageCoverImage to be null', () => {
    const event = buildEventData({
      title: 't',
      description: 'd',
      startDate: new Date('2026-05-01'),
      location: { type: 'text', coordinates: null, text: 'plaza' },
      organizationId: 'org1',
      organizationName: 'Org 1',
      createdBy: 'u1',
      villageId: 'v1',
      villageName: 'Becerril',
      villageCoverImage: null,
      villageCoordinates: new GeoPoint(0, 0),
    });
    expect(event.villageCoverImage).toBeNull();
  });
});
```

Run: `pnpm --filter @cultuvilla/shared test -- EventDataModel`
Expected: FAIL (`villageId` etc. not on EventData type).

- [ ] **Step 3: Update `EventDataModel.ts`**

Replace the contents of `packages/shared/src/models/event/EventDataModel.ts` with:

```typescript
import { GeoPoint } from 'firebase/firestore';
import { LocationData } from '../core/LocationDataModel';

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';

export interface EventData {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date | null;
  location: LocationData;
  imageURL: string | null;
  price: number | null;
  maxAttendees: number | null;
  telephoneRequired: boolean;
  status: EventStatus;
  organizationId: string;
  organizationName: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  // Village context (denormalized for feed rendering).
  villageId: string;
  villageName: string;
  villageCoverImage: string | null;
  villageCoordinates: GeoPoint;
}

export interface EventDataInput {
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date | null;
  location: LocationData;
  imageURL?: string | null;
  price?: number | null;
  maxAttendees?: number | null;
  telephoneRequired?: boolean;
  status?: EventStatus;
  organizationId: string;
  organizationName: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
  villageId: string;
  villageName: string;
  villageCoverImage?: string | null;
  villageCoordinates: GeoPoint;
}

export function buildEventData(input: EventDataInput): EventData {
  const now = new Date();
  return {
    title: input.title,
    description: input.description,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    location: input.location,
    imageURL: input.imageURL ?? null,
    price: input.price ?? null,
    maxAttendees: input.maxAttendees ?? null,
    telephoneRequired: input.telephoneRequired ?? false,
    status: input.status ?? 'draft',
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    villageId: input.villageId,
    villageName: input.villageName,
    villageCoverImage: input.villageCoverImage ?? null,
    villageCoordinates: input.villageCoordinates,
  };
}

export function isEventFull(event: EventData, confirmedCount: number): boolean {
  if (event.maxAttendees === null) return false;
  return confirmedCount >= event.maxAttendees;
}

export function isEventSignupOpen(event: EventData): boolean {
  return event.status === 'published';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared test -- EventDataModel`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/event/EventDataModel.ts packages/shared/test/models/EventDataModel.test.ts
git commit -m "feat(shared): add village denormalized fields to EventData"
```

---

### Task 2: Add `villageId`, `approvedBy`, `decidedAt` to `OrganizationDataModel`

**Files:**
- Modify: `packages/shared/src/models/organization/OrganizationDataModel.ts`
- Test: `packages/shared/test/models/OrganizationDataModel.test.ts` (create if missing)

- [ ] **Step 1: Write failing test**

Create `packages/shared/test/models/OrganizationDataModel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildOrganizationData } from '../../src/models/organization/OrganizationDataModel';

describe('OrganizationDataModel', () => {
  it('builds with villageId, defaults status pending and decision fields null', () => {
    const o = buildOrganizationData({
      name: 'Peña X',
      type: 'peña',
      requestedBy: 'u1',
      villageId: 'v1',
    });
    expect(o.name).toBe('Peña X');
    expect(o.villageId).toBe('v1');
    expect(o.status).toBe('pending');
    expect(o.approvedBy).toBeNull();
    expect(o.decidedAt).toBeNull();
  });

  it('preserves provided status, approvedBy, decidedAt', () => {
    const t = new Date('2026-04-01');
    const o = buildOrganizationData({
      name: 'A',
      type: 'asociación',
      requestedBy: 'u1',
      villageId: 'v1',
      status: 'approved',
      approvedBy: 'admin1',
      decidedAt: t,
    });
    expect(o.status).toBe('approved');
    expect(o.approvedBy).toBe('admin1');
    expect(o.decidedAt).toEqual(t);
  });
});
```

Run: `pnpm --filter @cultuvilla/shared test -- OrganizationDataModel`
Expected: FAIL (`villageId` not on type).

- [ ] **Step 2: Update model**

Replace contents of `packages/shared/src/models/organization/OrganizationDataModel.ts` with:

```typescript
export type OrganizationType = 'ayuntamiento' | 'peña' | 'asociación';
export type OrganizationStatus = 'pending' | 'approved' | 'rejected';

export interface OrganizationData {
  name: string;
  description: string | null;
  type: OrganizationType;
  status: OrganizationStatus;
  villageId: string;
  requestedBy: string;
  approvedBy: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}

export interface OrganizationDataInput {
  name: string;
  description?: string | null;
  type: OrganizationType;
  status?: OrganizationStatus;
  villageId: string;
  requestedBy: string;
  approvedBy?: string | null;
  createdAt?: Date;
  decidedAt?: Date | null;
}

export function buildOrganizationData(input: OrganizationDataInput): OrganizationData {
  return {
    name: input.name,
    description: input.description ?? null,
    type: input.type,
    status: input.status ?? 'pending',
    villageId: input.villageId,
    requestedBy: input.requestedBy,
    approvedBy: input.approvedBy ?? null,
    createdAt: input.createdAt ?? new Date(),
    decidedAt: input.decidedAt ?? null,
  };
}
```

- [ ] **Step 3: Verify test passes**

Run: `pnpm --filter @cultuvilla/shared test -- OrganizationDataModel`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/models/organization/OrganizationDataModel.ts packages/shared/test/models/OrganizationDataModel.test.ts
git commit -m "feat(shared): add villageId/approvedBy/decidedAt to OrganizationData"
```

---

## Phase 2 — Shared Services

### Task 3: Rewrite `eventService.ts` for top-level `events/`

**Files:**
- Modify: `packages/shared/src/services/eventService.ts`

- [ ] **Step 1: Replace file contents**

Replace `packages/shared/src/services/eventService.ts` with:

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
```

- [ ] **Step 2: Type-check the package**

Run: `pnpm --filter @cultuvilla/shared build`
Expected: PASS (the only consumers of the old `villageId` arg are not in this package; we'll fix them in later tasks).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/services/eventService.ts
git commit -m "refactor(shared): move eventService to top-level events collection"
```

---

### Task 4: Rewrite `organizationService.ts` for top-level `organizations/`

**Files:**
- Modify: `packages/shared/src/services/organizationService.ts`

- [ ] **Step 1: Replace file contents**

Replace `packages/shared/src/services/organizationService.ts` with:

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
import type {
  OrganizationData,
  OrganizationDataInput,
  OrganizationStatus,
} from '../models/organization/OrganizationDataModel';

function orgsCol() {
  return collection(db, 'organizations');
}

function mapOrgDoc(d: { id: string; data: () => Record<string, unknown> }): OrganizationData & { id: string } {
  const data = d.data();
  const decidedAtRaw = data['decidedAt'];
  return {
    id: d.id,
    name: data['name'] as string,
    description: (data['description'] as string | null) ?? null,
    type: data['type'] as OrganizationData['type'],
    status: data['status'] as OrganizationStatus,
    villageId: data['villageId'] as string,
    requestedBy: data['requestedBy'] as string,
    approvedBy: (data['approvedBy'] as string | null) ?? null,
    createdAt: (data['createdAt'] as Timestamp).toDate(),
    decidedAt: decidedAtRaw ? (decidedAtRaw as Timestamp).toDate() : null,
  };
}

export async function getOrganization(orgId: string): Promise<(OrganizationData & { id: string }) | null> {
  const snap = await getDoc(doc(orgsCol(), orgId));
  if (!snap.exists()) return null;
  return mapOrgDoc(snap as Parameters<typeof mapOrgDoc>[0]);
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
  return snap.docs.map((d) => mapOrgDoc(d as Parameters<typeof mapOrgDoc>[0]));
}

export async function requestOrganization(input: OrganizationDataInput): Promise<string> {
  const newRef = doc(orgsCol());
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
  await updateDoc(doc(orgsCol(), orgId), {
    status: 'approved',
    approvedBy,
    decidedAt: serverTimestamp(),
  });
}

export async function rejectOrganization(orgId: string, decidedBy: string): Promise<void> {
  await updateDoc(doc(orgsCol(), orgId), {
    status: 'rejected',
    approvedBy: decidedBy,
    decidedAt: serverTimestamp(),
  });
}

export async function updateOrganization(
  orgId: string,
  data: Partial<Omit<OrganizationData, 'createdAt' | 'requestedBy' | 'villageId'>>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(orgsCol(), orgId), data as any);
}

export async function deleteOrganization(orgId: string): Promise<void> {
  await deleteDoc(doc(orgsCol(), orgId));
}
```

- [ ] **Step 2: Build the package**

Run: `pnpm --filter @cultuvilla/shared build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/services/organizationService.ts
git commit -m "refactor(shared): move organizationService to top-level organizations collection"
```

---

### Task 5: Rewrite `orgMemberService.ts` (drop `villageId` arg)

**Files:**
- Modify: `packages/shared/src/services/orgMemberService.ts`

- [ ] **Step 1: Replace contents**

Replace `packages/shared/src/services/orgMemberService.ts` with:

```typescript
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { OrgMemberData } from '../models/organization/OrgMemberDataModel';

function orgMembersCol(orgId: string) {
  return collection(db, 'organizations', orgId, 'members');
}

export async function getOrgMembers(orgId: string): Promise<(OrgMemberData & { id: string })[]> {
  const snap = await getDocs(orgMembersCol(orgId));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      joinedAt: (data['joinedAt'] as Timestamp).toDate(),
    };
  });
}

export async function addOrgMember(orgId: string, userId: string): Promise<void> {
  await setDoc(doc(orgMembersCol(orgId), userId), {
    joinedAt: serverTimestamp(),
  });
}

export async function removeOrgMember(orgId: string, userId: string): Promise<void> {
  await deleteDoc(doc(orgMembersCol(orgId), userId));
}

export async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
  const snap = await getDoc(doc(orgMembersCol(orgId), userId));
  return snap.exists();
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @cultuvilla/shared build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/services/orgMemberService.ts
git commit -m "refactor(shared): drop villageId from orgMemberService"
```

---

### Task 6: Update `registrationService.ts` for top-level event paths

**Files:**
- Modify: `packages/shared/src/services/registrationService.ts`
- Modify: `packages/shared/test/services/registrationService.test.ts`

- [ ] **Step 1: Update the failing test if any references villageId**

Read `packages/shared/test/services/registrationService.test.ts` and update any signatures from `(villageId, eventId, ...)` to `(eventId, ...)`. Pure functions like `determineRegistrationStatus` are unaffected.

- [ ] **Step 2: Replace service contents**

Replace `packages/shared/src/services/registrationService.ts` with:

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
import type { RegistrationData, RegistrationStatus } from '../models/event/RegistrationDataModel';

export interface RegisterInput {
  userId: string;
  personaId: string | null;
  name: string;
}

function regsCol(eventId: string) {
  return collection(db, 'events', eventId, 'registrations');
}

function mapRegDoc(
  d: { id: string; data: () => Record<string, unknown> }
): RegistrationData & { id: string } {
  const data = d.data();
  return {
    id: d.id,
    userId: data['userId'] as string,
    personaId: (data['personaId'] as string | null) ?? null,
    name: data['name'] as string,
    status: data['status'] as RegistrationStatus,
    position: data['position'] as number,
    registeredAt: (data['registeredAt'] as Timestamp).toDate(),
  };
}

/**
 * Pure function for testability.
 * Returns 'confirmed' if under maxAttendees, 'waitlisted' if at or over.
 */
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
  return snap.docs.map((d) => mapRegDoc(d as Parameters<typeof mapRegDoc>[0]));
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
  return snap.docs.map((d) => mapRegDoc(d as Parameters<typeof mapRegDoc>[0]));
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
    const newRef = doc(regsCol(eventId));
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
  await deleteDoc(doc(regsCol(eventId), regId));
}

/**
 * Cross-event registrations for a single user. After the migration,
 * registrations live at events/{eventId}/registrations/{regId}, so the
 * eventPath returned is `events/{eventId}`.
 */
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
    // ref path: events/{eventId}/registrations/{regId}
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

- [ ] **Step 3: Run shared tests**

Run: `pnpm --filter @cultuvilla/shared test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/services/registrationService.ts packages/shared/test/services/registrationService.test.ts
git commit -m "refactor(shared): registrationService uses top-level event paths"
```

---

### Task 7: Create `feedService.ts` (feed query + haversine)

**Files:**
- Create: `packages/shared/src/services/feedService.ts`
- Create: `packages/shared/test/services/feedHaversine.test.ts`

- [ ] **Step 1: Write failing test for haversine**

Create `packages/shared/test/services/feedHaversine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { GeoPoint } from 'firebase/firestore';
import { haversineKm } from '../../src/services/feedService';

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    const p = new GeoPoint(40.5, -4.0);
    expect(haversineKm(p, p)).toBe(0);
  });

  it('returns ~111 km for one degree of latitude difference', () => {
    const a = new GeoPoint(40.0, 0.0);
    const b = new GeoPoint(41.0, 0.0);
    const km = haversineKm(a, b);
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112);
  });

  it('returns ~85 km for one degree of longitude at lat 40 (cosine effect)', () => {
    const a = new GeoPoint(40.0, 0.0);
    const b = new GeoPoint(40.0, 1.0);
    const km = haversineKm(a, b);
    expect(km).toBeGreaterThan(84);
    expect(km).toBeLessThan(86);
  });
});
```

Run: `pnpm --filter @cultuvilla/shared test -- feedHaversine`
Expected: FAIL.

- [ ] **Step 2: Create the service**

Create `packages/shared/src/services/feedService.ts`:

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
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';
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
    ? query(collection(db, 'events'), ...baseConstraints, startAfter(cursor))
    : query(collection(db, 'events'), ...baseConstraints);

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

export function filterByDistanceKm<T extends { villageCoordinates: GeoPoint }>(
  events: T[],
  reference: GeoPoint,
  maxKm: number,
): T[] {
  return events.filter((e) => haversineKm(reference, e.villageCoordinates) <= maxKm);
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @cultuvilla/shared test -- feedHaversine`
Expected: PASS.

- [ ] **Step 4: Re-export from services index if barrel exists**

Read `packages/shared/src/services/index.ts`. If it re-exports each service, append:

```typescript
export * from './feedService';
```

If the file does not exist or is unused (consumers import service files directly), skip this step.

- [ ] **Step 5: Build package**

Run: `pnpm --filter @cultuvilla/shared build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/services/feedService.ts packages/shared/src/services/index.ts packages/shared/test/services/feedHaversine.test.ts
git commit -m "feat(shared): add feedService with feed query and haversine helpers"
```

---

## Phase 3 — Backend (Cloud Function, Rules, Indexes)

### Task 8: Cloud Function — sync village denormalization to events

**Files:**
- Create: `functions/src/syncVillageDenormalization.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Create the trigger module**

Create `functions/src/syncVillageDenormalization.ts`:

```typescript
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * When a village's name, first image, or coordinates change, propagate to
 * all events with that villageId so the feed always renders fresh values.
 */
export const syncVillageDenormalization = onDocumentUpdated(
  { document: 'villages/{villageId}', region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() ?? {};
    const after = event.data?.after.data() ?? {};
    const villageId = event.params.villageId;

    const nameChanged = before['name'] !== after['name'];
    const imagesChanged =
      JSON.stringify(before['images'] ?? []) !== JSON.stringify(after['images'] ?? []);
    const coordsChanged =
      JSON.stringify(before['coordinates'] ?? null) !==
      JSON.stringify(after['coordinates'] ?? null);

    if (!nameChanged && !imagesChanged && !coordsChanged) return;

    const eventsSnap = await db
      .collection('events')
      .where('villageId', '==', villageId)
      .get();

    if (eventsSnap.empty) return;

    const cover = Array.isArray(after['images']) && after['images'].length > 0
      ? (after['images'][0] as string)
      : null;

    const update: Record<string, unknown> = {};
    if (nameChanged) update['villageName'] = after['name'];
    if (imagesChanged) update['villageCoverImage'] = cover;
    if (coordsChanged) update['villageCoordinates'] = after['coordinates'];

    // Firestore batch limit is 500; chunk if needed.
    const docs = eventsSnap.docs;
    for (let i = 0; i < docs.length; i += 500) {
      const batch = db.batch();
      docs.slice(i, i + 500).forEach((d) => batch.update(d.ref, update));
      await batch.commit();
    }
  },
);
```

- [ ] **Step 2: Register in `functions/src/index.ts`**

Read `functions/src/index.ts` and add:

```typescript
export { syncVillageDenormalization } from './syncVillageDenormalization';
```

(Place alongside other exports such as `acceptInvite`.)

- [ ] **Step 3: Build functions**

Run: `pnpm --filter functions build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add functions/src/syncVillageDenormalization.ts functions/src/index.ts
git commit -m "feat(functions): trigger to sync village denormalization to events"
```

---

### Task 9: Update `firestore.rules` for top-level events and organizations

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Replace contents**

Replace `firestore.rules` with:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() { return request.auth != null; }
    function isOwner(userId) { return isAuthenticated() && request.auth.uid == userId; }
    function isAppAdmin() {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    function isVillageAdmin(villageId) {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/villages/$(villageId)/members/$(request.auth.uid)).data.role == 'admin';
    }
    function isVillageMember(villageId) {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/villages/$(villageId)/members/$(request.auth.uid));
    }
    function isOrgMember(orgId) {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid));
    }
    function orgVillageId(orgId) {
      return get(/databases/$(database)/documents/organizations/$(orgId)).data.villageId;
    }

    match /admins/{userId} {
      allow read: if isOwner(userId) || isAppAdmin();
      allow write: if false;
    }

    match /users/{userId} {
      allow read: if true;
      allow create: if isOwner(userId);
      allow update: if isOwner(userId);
      allow delete: if false;

      match /personas/{personaId} {
        allow read, create, update, delete: if isOwner(userId);
      }

      match /notifications/{notifId} {
        allow read: if isOwner(userId);
        allow update: if isOwner(userId)
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read']);
        allow create, delete: if false;
      }
    }

    match /villages/{villageId} {
      allow read: if true;
      allow create: if isAppAdmin();
      allow update: if isVillageAdmin(villageId) || isAppAdmin();
      allow delete: if isAppAdmin();

      match /members/{userId} {
        allow read: if true;
        allow create: if isVillageAdmin(villageId) || isAppAdmin();
        allow update: if isVillageAdmin(villageId) || isAppAdmin() || isOwner(userId);
        allow delete: if isVillageAdmin(villageId) || isAppAdmin() || isOwner(userId);
      }

      match /inviteTokens/{tokenId} {
        allow read: if true;
        allow create: if isVillageAdmin(villageId) || isAppAdmin();
        allow update: if isAuthenticated();
        allow delete: if isVillageAdmin(villageId) || isAppAdmin();
      }
    }

    match /organizations/{orgId} {
      allow read: if true;
      allow create: if isAuthenticated()
        && (isVillageMember(request.resource.data.villageId) || isAppAdmin())
        && request.resource.data.status == 'pending';
      allow update: if isVillageAdmin(resource.data.villageId) || isAppAdmin();
      allow delete: if isVillageAdmin(resource.data.villageId) || isAppAdmin();

      match /members/{userId} {
        allow read: if true;
        allow create: if isOrgMember(orgId)
          || isVillageAdmin(orgVillageId(orgId))
          || isAppAdmin();
        allow update: if false;
        allow delete: if isOwner(userId)
          || isVillageAdmin(orgVillageId(orgId))
          || isAppAdmin();
      }
    }

    match /events/{eventId} {
      allow read: if true;
      allow create: if isAuthenticated()
        && isOrgMember(request.resource.data.organizationId)
        && request.resource.data.villageId is string;
      allow update: if isOrgMember(resource.data.organizationId)
        || isVillageAdmin(resource.data.villageId)
        || isAppAdmin();
      allow delete: if isOrgMember(resource.data.organizationId)
        || isVillageAdmin(resource.data.villageId)
        || isAppAdmin();

      match /registrations/{regId} {
        allow read: if true;
        allow create: if isAuthenticated()
          && request.resource.data.userId == request.auth.uid;
        allow update: if isAuthenticated()
          && resource.data.userId == request.auth.uid;
        allow delete: if isAuthenticated()
          && resource.data.userId == request.auth.uid;
      }
    }
  }
}
```

- [ ] **Step 2: Compile-check rules locally (optional but recommended)**

Run: `firebase deploy --only firestore:rules --dry-run --project villa-events`
Expected: rules file compiled successfully.

- [ ] **Step 3: Commit (do NOT deploy yet)**

```bash
git add firestore.rules
git commit -m "feat(rules): top-level events/orgs, drop nested matches"
```

---

### Task 10: Update `firestore.indexes.json`

**Files:**
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Replace contents**

Replace `firestore.indexes.json` with:

```json
{
  "indexes": [
    {
      "collectionGroup": "events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "startDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "villageId", "order": "ASCENDING" },
        { "fieldPath": "startDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "startDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "villageId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "startDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "organizations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "villageId", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "organizations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "villageId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "registrations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "position", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "registrations",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "registeredAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "read", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": [
    {
      "collectionGroup": "members",
      "fieldPath": "userId",
      "indexes": [
        { "queryScope": "COLLECTION_GROUP", "order": "ASCENDING" }
      ]
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add firestore.indexes.json
git commit -m "feat(indexes): top-level events/orgs indexes, drop nested exemptions"
```

---

## Phase 4 — Migration

### Task 11: Write the one-shot migration script

**Files:**
- Create: `scripts/migrate-to-flat.mjs`

- [ ] **Step 1: Create script**

Create `scripts/migrate-to-flat.mjs`:

```javascript
#!/usr/bin/env node
// One-shot migration: nested villages/{vid}/{events,organizations} -> top-level.
// Usage: node scripts/migrate-to-flat.mjs --project villa-events --commit
// Without --commit, it runs as a dry run (logs only).

import admin from 'firebase-admin';

const args = process.argv.slice(2);
const projectArg = args.includes('--project') ? args[args.indexOf('--project') + 1] : null;
const commit = args.includes('--commit');

if (!projectArg) {
  console.error('Missing --project <projectId>');
  process.exit(1);
}

admin.initializeApp({ projectId: projectArg });
const db = admin.firestore();

async function main() {
  console.log(`[migrate] project=${projectArg} commit=${commit}`);
  const villagesSnap = await db.collection('villages').get();
  console.log(`[migrate] found ${villagesSnap.size} villages`);

  let orgCount = 0, orgMemberCount = 0, eventCount = 0, regCount = 0;

  for (const villageDoc of villagesSnap.docs) {
    const vid = villageDoc.id;
    const village = villageDoc.data();
    const villageName = village.name ?? '';
    const villageImages = Array.isArray(village.images) ? village.images : [];
    const villageCover = villageImages.length > 0 ? villageImages[0] : null;
    const villageCoords = village.coordinates ?? null;

    // -- ORGANIZATIONS --
    const nestedOrgsSnap = await db.collection('villages').doc(vid).collection('organizations').get();
    for (const orgDoc of nestedOrgsSnap.docs) {
      const oid = orgDoc.id;
      const orgData = orgDoc.data();
      const flatRef = db.collection('organizations').doc(oid);
      const flatExists = (await flatRef.get()).exists;

      if (!flatExists) {
        const newDoc = {
          ...orgData,
          villageId: vid,
          approvedBy: orgData.approvedBy ?? null,
          decidedAt: orgData.decidedAt ?? null,
        };
        if (commit) await flatRef.set(newDoc);
        console.log(`[org] ${vid}/${oid} -> organizations/${oid}`);
        orgCount++;
      } else {
        console.log(`[org] ${vid}/${oid} already exists at top-level, skipping`);
      }

      // org members
      const orgMembersSnap = await orgDoc.ref.collection('members').get();
      for (const memberDoc of orgMembersSnap.docs) {
        const flatMemberRef = flatRef.collection('members').doc(memberDoc.id);
        const flatMemberExists = (await flatMemberRef.get()).exists;
        if (!flatMemberExists) {
          if (commit) await flatMemberRef.set(memberDoc.data());
          console.log(`[org-member] ${vid}/${oid}/${memberDoc.id}`);
          orgMemberCount++;
        }
      }
    }

    // -- EVENTS --
    const nestedEventsSnap = await db.collection('villages').doc(vid).collection('events').get();
    for (const eventDoc of nestedEventsSnap.docs) {
      const eid = eventDoc.id;
      const eventData = eventDoc.data();
      const flatRef = db.collection('events').doc(eid);
      const flatExists = (await flatRef.get()).exists;

      if (!flatExists) {
        const newDoc = {
          ...eventData,
          villageId: vid,
          villageName,
          villageCoverImage: villageCover,
          villageCoordinates: villageCoords,
        };
        if (commit) await flatRef.set(newDoc);
        console.log(`[event] ${vid}/${eid} -> events/${eid}`);
        eventCount++;
      } else {
        console.log(`[event] ${vid}/${eid} already at top-level, skipping`);
      }

      // registrations
      const regsSnap = await eventDoc.ref.collection('registrations').get();
      for (const regDoc of regsSnap.docs) {
        const flatRegRef = flatRef.collection('registrations').doc(regDoc.id);
        const flatRegExists = (await flatRegRef.get()).exists;
        if (!flatRegExists) {
          if (commit) await flatRegRef.set(regDoc.data());
          console.log(`[reg] ${vid}/${eid}/${regDoc.id}`);
          regCount++;
        }
      }
    }
  }

  console.log(`[migrate] DONE — orgs=${orgCount} orgMembers=${orgMemberCount} events=${eventCount} regs=${regCount} (commit=${commit})`);

  if (!commit) {
    console.log(`[migrate] Dry run. Re-run with --commit to write.`);
  } else {
    console.log(`[migrate] WROTE to top-level. Old nested docs are STILL THERE. Verify, then run with --delete-nested to remove.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Make executable**

Run: `chmod +x scripts/migrate-to-flat.mjs`

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-to-flat.mjs
git commit -m "feat(scripts): one-shot migration nested -> top-level events/orgs"
```

---

### Task 12: Run migration, deploy rules + indexes + functions

**Files:** none (operational task)

- [ ] **Step 1: Set ADC quota project (if not already)**

Run: `gcloud auth application-default set-quota-project villa-events`
Expected: confirmation message.

- [ ] **Step 2: Dry-run the migration**

Run: `node scripts/migrate-to-flat.mjs --project villa-events`
Expected: lists every org/event/registration that would be copied. Verify counts look sensible.

- [ ] **Step 3: Commit-run the migration**

Run: `node scripts/migrate-to-flat.mjs --project villa-events --commit`
Expected: writes complete; final summary line shows non-zero counts.

- [ ] **Step 4: Spot-check in Firebase Console**

Open the Firestore console and confirm:
- `organizations/{orgId}` docs exist with `villageId` set.
- `events/{eventId}` docs exist with `villageId`, `villageName`, `villageCoverImage`, `villageCoordinates` set.
- `events/{eventId}/registrations/{regId}` exist for events that had registrations.

- [ ] **Step 5: Deploy indexes**

Run: `firebase deploy --only firestore:indexes --project villa-events`
Expected: deploy complete. Indexes may take a few minutes to build; that's fine — they don't block writes.

- [ ] **Step 6: Deploy functions**

Run: `firebase deploy --only functions --project villa-events`
Expected: deploy complete; both `acceptInvite` and `syncVillageDenormalization` listed as deployed.

- [ ] **Step 7: Deploy rules**

Run: `firebase deploy --only firestore:rules --project villa-events`
Expected: rules released.

- [ ] **Step 8: Smoke test from a browser tab**

In a logged-in browser:
- Open the Firestore console and write a test field on a village (e.g., bump description). Verify the trigger doesn't fire (we only watch name/images/coordinates).
- Rename a village. Verify all that village's events get `villageName` updated within ~10s.
- Revert the rename.

- [ ] **Step 9: Do not delete the nested docs yet**

The nested copies stay until the web cutover (Phase 5–6) is verified. Leave them.

(No commit — operational only.)

---

## Phase 5 — Web Routes (flat structure)

### Task 13: Add `/event/[eventId]/page.tsx`

**Files:**
- Create: `apps/web/app/event/[eventId]/page.tsx`

- [ ] **Step 1: Read the existing nested page to understand its props/queries**

Run: `cat apps/web/app/village/\[id\]/event/\[eventId\]/page.tsx`

Note signup/cancel/registration handling — the new page mirrors the same UX with updated service signatures. Identify any helper components used (e.g., `SignUpModal`).

- [ ] **Step 2: Create the new page**

Create `apps/web/app/event/[eventId]/page.tsx`. Use the existing nested page as the template. Replace:
- `getEvent(villageId, eventId)` → `getEvent(eventId)`
- `getEventRegistrations(villageId, eventId)` → `getEventRegistrations(eventId)`
- `getConfirmedCount(villageId, eventId)` → `getConfirmedCount(eventId)`
- `registerToEvent(villageId, eventId, ...)` → `registerToEvent(eventId, ...)`
- `cancelRegistration(villageId, eventId, regId)` → `cancelRegistration(eventId, regId)`
- Use `event.villageId` and `event.villageName` from the event doc itself (it now carries them).
- Pass `eventId` to `SignUpModal` instead of `(villageId, eventId)`; update the modal in Task 21 step.

Wire the page to use `useParams<{ eventId: string }>()` for the route param.

- [ ] **Step 3: Verify page compiles**

Run: `pnpm --filter web build` (or `pnpm --filter web typecheck` if available)
Expected: PASS or only failures in the still-existing nested page (which we delete in Task 16).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/event/
git commit -m "feat(web): add /event/[eventId] page at flat path"
```

---

### Task 14: Add `/org/[orgId]/page.tsx`

**Files:**
- Create: `apps/web/app/org/[orgId]/page.tsx`

- [ ] **Step 1: Create the page**

Mirror `apps/web/app/village/[id]/org/[orgId]/page.tsx` with updated service signatures:
- `getOrganization(orgId)` (single arg)
- `getEventsByOrganization(orgId)` to list events for this org
- Read the org's `villageId` from the org doc, then fetch the village header info via `getVillage(org.villageId)` if you need village name/images on this page (or read denormalized fields from the events themselves).

The page renders: org header, member list (call `getOrgMembers(orgId)`), upcoming events, "Crear evento" button if `isOrgMember(orgId, user.uid)` is true.

- [ ] **Step 2: Verify build**

Run: `pnpm --filter web build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/org/
git commit -m "feat(web): add /org/[orgId] page at flat path"
```

---

### Task 15: Add `/org/[orgId]/events/new/page.tsx` and `/org/[orgId]/events/[eventId]/edit/page.tsx`

**Files:**
- Create: `apps/web/app/org/[orgId]/events/new/page.tsx`
- Create: `apps/web/app/org/[orgId]/events/[eventId]/edit/page.tsx`

- [ ] **Step 1: New event page**

Mirror `apps/web/app/village/[id]/org/[orgId]/events/new/page.tsx`. On submit:
1. Fetch the org via `getOrganization(orgId)` to get `villageId`.
2. Fetch the village via `getVillage(org.villageId)` to get `name`, `images`, `coordinates`.
3. Call `createEvent({ ...form, organizationId, organizationName, createdBy, villageId, villageName, villageCoverImage, villageCoordinates })`.
4. Redirect to `/event/{newId}`.

- [ ] **Step 2: Edit event page**

Mirror the existing nested edit page. Use `getEvent(eventId)` then `updateEvent(eventId, partialData)`. Do not allow editing `villageId` (locked at creation).

- [ ] **Step 3: Verify build**

Run: `pnpm --filter web build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/org/[orgId]/events/
git commit -m "feat(web): add /org/[orgId]/events/{new,[id]/edit} flat routes"
```

---

### Task 16: Delete nested `village/[id]/event/` and `village/[id]/org/` subtrees

**Files:**
- Delete: `apps/web/app/village/[id]/event/`
- Delete: `apps/web/app/village/[id]/org/`

- [ ] **Step 1: Remove directories**

```bash
rm -rf apps/web/app/village/\[id\]/event apps/web/app/village/\[id\]/org
```

- [ ] **Step 2: Verify build still works**

Run: `pnpm --filter web build`
Expected: build still passes (the nested pages were the only callers of the old service signatures we removed). If it fails, fix the offending importer to use the flat-path service.

- [ ] **Step 3: Commit**

```bash
git add -A apps/web/app/village/
git commit -m "chore(web): remove nested event/org route subtrees"
```

---

## Phase 6 — Web Pages (feature changes)

### Task 17: Replace home (`apps/web/app/page.tsx`) with the global feed

**Files:**
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/components/feed/FeedCard.tsx`
- Create: `apps/web/components/feed/FeedFilterBar.tsx`

- [ ] **Step 1: Create `FeedCard`**

Create `apps/web/components/feed/FeedCard.tsx`:

```tsx
import Link from 'next/link';
import { Calendar, MapPin } from 'lucide-react';
import type { EventData } from '@cultuvilla/shared/models/event';

interface FeedCardProps {
  event: EventData & { id: string };
}

export function FeedCard({ event }: FeedCardProps) {
  const dateLabel = event.startDate.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Link
      href={`/event/${event.id}`}
      className="block bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition"
    >
      {event.imageURL ? (
        <img src={event.imageURL} alt={event.title} className="w-full h-40 object-cover" />
      ) : event.villageCoverImage ? (
        <img src={event.villageCoverImage} alt={event.villageName} className="w-full h-40 object-cover opacity-60" />
      ) : (
        <div className="w-full h-40 bg-gray-100" />
      )}
      <div className="p-4">
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
          <MapPin size={12} />
          <span>{event.villageName}</span>
        </div>
        <h3 className="text-base font-semibold text-gray-900 line-clamp-1">{event.title}</h3>
        <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
          <Calendar size={12} />
          <span>{dateLabel}</span>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create `FeedFilterBar`**

Create `apps/web/components/feed/FeedFilterBar.tsx`:

```tsx
'use client';

interface FeedFilterBarProps {
  nearbyOn: boolean;
  nearbyAvailable: boolean;
  onToggleNearby: () => void;
}

export function FeedFilterBar({ nearbyOn, nearbyAvailable, onToggleNearby }: FeedFilterBarProps) {
  if (!nearbyAvailable) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
      <button
        type="button"
        onClick={onToggleNearby}
        className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
          nearbyOn ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
        }`}
      >
        Cerca de mí
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Replace `app/page.tsx`**

Replace `apps/web/app/page.tsx` with:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { GeoPoint } from 'firebase/firestore';
import { getUpcomingFeed, filterByDistanceKm } from '@cultuvilla/shared/services/feedService';
import { getVillage } from '@cultuvilla/shared/services/villageService';
import type { EventData } from '@cultuvilla/shared/models/event';
import { useAuth } from '@/hooks/useAuth';
import { FeedCard } from '@/components/feed/FeedCard';
import { FeedFilterBar } from '@/components/feed/FeedFilterBar';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';

const NEARBY_RADIUS_KM = 50;

export default function HomePage() {
  const { user, profile, loading: authLoading, profileChecked } = useAuth();
  const [events, setEvents] = useState<(EventData & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [nearbyOn, setNearbyOn] = useState(false);
  const [referencePoint, setReferencePoint] = useState<GeoPoint | null>(null);

  // Resume any pending invite first; never auto-redirect to a village.
  useEffect(() => {
    if (authLoading || !profileChecked) return;
    if (typeof window !== 'undefined') {
      const pending = sessionStorage.getItem('villa-events:pendingInvite');
      if (pending) {
        sessionStorage.removeItem('villa-events:pendingInvite');
        window.location.replace(pending);
      }
    }
  }, [authLoading, profileChecked]);

  // Resolve the reference point for "Cerca de mí" — active village's coords, else geolocation.
  useEffect(() => {
    if (!user || !profile?.activeVillageId) return;
    getVillage(profile.activeVillageId).then((v) => {
      if (v) setReferencePoint(v.coordinates);
    });
  }, [user, profile?.activeVillageId]);

  // Load the feed.
  useEffect(() => {
    setLoading(true);
    getUpcomingFeed(20)
      .then(({ events }) => setEvents(events))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    if (!nearbyOn || !referencePoint) return events;
    return filterByDistanceKm(events, referencePoint, NEARBY_RADIUS_KM);
  }, [events, nearbyOn, referencePoint]);

  return (
    <div>
      <FeedFilterBar
        nearbyOn={nearbyOn}
        nearbyAvailable={!!referencePoint}
        onToggleNearby={() => setNearbyOn((v) => !v)}
      />
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Próximos eventos</h1>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonLoader key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="text-gray-500 text-sm py-12 text-center">
            {nearbyOn ? 'No hay eventos cerca de ti.' : 'Aún no hay eventos publicados.'}
          </p>
        ) : (
          <div className="space-y-3">
            {visible.map((e) => (
              <FeedCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter web build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx apps/web/components/feed/
git commit -m "feat(web): replace home with global event feed and Cerca de mí filter"
```

---

### Task 18: Reframe `village/[id]/page.tsx` as a village info page

**Files:**
- Modify: `apps/web/app/village/[id]/page.tsx`

- [ ] **Step 1: Rewrite the page**

Replace `apps/web/app/village/[id]/page.tsx` with:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getVillage } from '@cultuvilla/shared/services/villageService';
import { getEventsByVillage } from '@cultuvilla/shared/services/eventService';
import { getOrganizationsByVillage } from '@cultuvilla/shared/services/organizationService';
import { isVillageMember } from '@cultuvilla/shared/services/villageMemberService';
import type { VillageData } from '@cultuvilla/shared/models/village';
import type { EventData } from '@cultuvilla/shared/models/event';
import type { OrganizationData } from '@cultuvilla/shared/models/organization';
import { useAuth } from '@/hooks/useAuth';
import { FeedCard } from '@/components/feed/FeedCard';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';

export default function VillagePage() {
  const params = useParams<{ id: string }>();
  const villageId = params.id;
  const { user } = useAuth();

  const [village, setVillage] = useState<(VillageData & { id: string }) | null>(null);
  const [events, setEvents] = useState<(EventData & { id: string })[]>([]);
  const [orgs, setOrgs] = useState<(OrganizationData & { id: string })[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!villageId) return;
    Promise.all([
      getVillage(villageId),
      getEventsByVillage(villageId, 'published'),
      getOrganizationsByVillage(villageId, 'approved'),
      user ? isVillageMember(villageId, user.uid) : Promise.resolve(false),
    ])
      .then(([v, evs, os, mem]) => {
        setVillage(v);
        setEvents(evs);
        setOrgs(os);
        setIsMember(mem);
      })
      .finally(() => setLoading(false));
  }, [villageId, user]);

  if (loading) {
    return (
      <div className="px-4 py-6 space-y-4">
        <SkeletonLoader className="h-40 rounded-xl" />
        <SkeletonLoader className="h-6 w-40" />
        <SkeletonLoader className="h-20 rounded-xl" />
      </div>
    );
  }

  if (!village) {
    return <p className="px-4 py-6 text-gray-500">Pueblo no encontrado.</p>;
  }

  const cover = village.images?.[0] ?? null;

  return (
    <div className="pb-12">
      {cover ? (
        <img src={cover} alt={village.name} className="w-full h-44 object-cover" />
      ) : (
        <div className="w-full h-44 bg-gray-100" />
      )}

      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900">{village.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{village.provincia}</p>
        {village.description && <p className="text-sm text-gray-700 mt-3">{village.description}</p>}

        {!isMember && user && (
          <div className="mt-4 p-3 rounded-lg bg-blue-50 text-blue-800 text-sm">
            Eres visitante. Pídele a un coordinador un enlace de invitación para hacerte vecino y poder rellenar el censo.
          </div>
        )}

        <h2 className="text-sm font-semibold text-gray-700 mt-8 mb-3">Próximos eventos</h2>
        {events.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay eventos próximos en {village.name}.</p>
        ) : (
          <div className="space-y-3">
            {events.map((e) => <FeedCard key={e.id} event={e} />)}
          </div>
        )}

        <h2 className="text-sm font-semibold text-gray-700 mt-8 mb-3">Asociaciones y peñas</h2>
        {orgs.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay organizaciones aprobadas todavía.</p>
        ) : (
          <ul className="space-y-2">
            {orgs.map((o) => (
              <li key={o.id}>
                <Link href={`/org/${o.id}`} className="text-sm text-blue-700 hover:underline">
                  {o.name}
                </Link>
                <span className="text-xs text-gray-400 ml-2">{o.type}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter web build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/village/\[id\]/page.tsx
git commit -m "refactor(web): village page becomes info/discovery, not home"
```

---

### Task 19: Update profile to show "Mis pueblos" and demote the active switcher

**Files:**
- Modify: `apps/web/app/profile/page.tsx`

- [ ] **Step 1: Replace the "Mi pueblo" block**

In `apps/web/app/profile/page.tsx`, replace the existing block that shows `Mi pueblo` + `Cambiar` with a list of all memberships. Concretely, replace the section starting with `{/* My village */}` and ending after the switcher block with:

```tsx
{/* My villages */}
<div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
  <div className="flex items-center gap-2 mb-3">
    <MapPin size={18} className="text-gray-500" />
    <p className="text-sm font-semibold text-gray-900">Mis pueblos</p>
  </div>
  {memberships.length === 0 ? (
    <p className="text-sm text-gray-500">Aún no perteneces a ningún pueblo.</p>
  ) : (
    <ul className="space-y-2">
      {memberships.map((m) => {
        const v = villagesById[m.villageId];
        if (!v) return null;
        const isActive = m.villageId === profile.activeVillageId;
        return (
          <li key={m.villageId} className="flex items-center justify-between">
            <Link href={`/village/${m.villageId}`} className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{v.name}</p>
              <p className="text-xs text-gray-400">{v.provincia}</p>
            </Link>
            {isActive ? (
              <span className="text-xs text-blue-700 px-2 py-0.5 rounded-full bg-blue-50">Principal</span>
            ) : (
              <button
                type="button"
                onClick={() => handleSwitchVillage(m.villageId)}
                disabled={switching}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
              >
                Hacer principal
              </button>
            )}
          </li>
        );
      })}
    </ul>
  )}
</div>
```

(Keep the `handleSwitchVillage` callback as-is; it still writes `activeVillageId` for the "Cerca de mí" reference.)

- [ ] **Step 2: Build**

Run: `pnpm --filter web build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/profile/page.tsx
git commit -m "feat(web): profile lists all villages, demotes active switcher to 'Hacer principal'"
```

---

### Task 20: Update `my-signups` to parse the new `eventPath` shape

**Files:**
- Modify: `apps/web/app/my-signups/page.tsx`

- [ ] **Step 1: Update the imported function name and path parser**

In `apps/web/app/my-signups/page.tsx`:

1. Replace import:
   ```typescript
   import { getUserRegistrationsAcrossVillages } from '@cultuvilla/shared/services/registrationService';
   ```
   with:
   ```typescript
   import { getUserRegistrationsAcrossEvents } from '@cultuvilla/shared/services/registrationService';
   ```

2. Replace the call site:
   ```typescript
   getUserRegistrationsAcrossVillages(user.uid)
   ```
   with:
   ```typescript
   getUserRegistrationsAcrossEvents(user.uid)
   ```

3. Replace the `parseEventPath` function with:

   ```typescript
   function parseEventPath(eventPath: string): { eventId: string } | null {
     // path: events/{eventId}
     const parts = eventPath.split('/');
     if (parts.length !== 2 || parts[0] !== 'events') return null;
     return { eventId: parts[1] };
   }
   ```

4. Replace the `href` resolution:
   ```typescript
   const href = parsed
     ? `/village/${parsed.villageId}/event/${parsed.eventId}`
     : '#';
   ```
   with:
   ```typescript
   const href = parsed ? `/event/${parsed.eventId}` : '#';
   ```

- [ ] **Step 2: Build**

Run: `pnpm --filter web build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/my-signups/page.tsx
git commit -m "refactor(web): my-signups uses top-level event paths"
```

---

### Task 21: Attendee badge (Vecino / Visitante) on event detail

**Files:**
- Create: `apps/web/components/event/AttendeeBadge.tsx`
- Modify: `apps/web/app/event/[eventId]/page.tsx`
- Modify: `apps/web/components/event/SignUpModal.tsx` (drop villageId arg)

- [ ] **Step 1: Create the badge component**

Create `apps/web/components/event/AttendeeBadge.tsx`:

```tsx
interface AttendeeBadgeProps {
  isVecino: boolean;
}

export function AttendeeBadge({ isVecino }: AttendeeBadgeProps) {
  return isVecino ? (
    <span className="text-[10px] uppercase tracking-wide bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
      Vecino
    </span>
  ) : (
    <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
      Visitante
    </span>
  );
}
```

- [ ] **Step 2: Look up membership status for each registration**

In `apps/web/app/event/[eventId]/page.tsx`, after fetching `registrations`, build a `Set<string>` of userIds that are members of the event's village. Use a single read per attendee for now (small attendee counts):

```typescript
import { isVillageMember } from '@cultuvilla/shared/services/villageMemberService';
// inside the page component:
const [memberOfVillage, setMemberOfVillage] = useState<Set<string>>(new Set());

useEffect(() => {
  if (!event || registrations.length === 0) return;
  const uniqueUserIds = Array.from(new Set(registrations.map((r) => r.userId)));
  Promise.all(
    uniqueUserIds.map((uid) =>
      isVillageMember(event.villageId, uid).then((ok) => (ok ? uid : null)),
    ),
  ).then((results) => {
    setMemberOfVillage(new Set(results.filter((x): x is string => x !== null)));
  });
}, [event, registrations]);
```

In the JSX where each registration is rendered, add:

```tsx
<AttendeeBadge isVecino={memberOfVillage.has(reg.userId)} />
```

- [ ] **Step 3: Update `SignUpModal` to drop the `villageId` arg**

Read `apps/web/components/event/SignUpModal.tsx`. Wherever it calls `registerToEvent(villageId, eventId, ...)`, drop the `villageId` argument. Update the props interface and the props passed in by the event detail page.

- [ ] **Step 4: Build**

Run: `pnpm --filter web build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/event/AttendeeBadge.tsx apps/web/components/event/SignUpModal.tsx apps/web/app/event/\[eventId\]/page.tsx
git commit -m "feat(web): attendee Vecino/Visitante badges, signup modal drops villageId"
```

---

### Task 22: BottomNav — drop village-aware framing

**Files:**
- Modify: `apps/web/components/common/BottomNav.tsx`

- [ ] **Step 1: Remove village-id-aware logic**

Read `apps/web/components/common/BottomNav.tsx`. If the "Inicio" item points to `/village/{activeVillageId}` or any village-scoped route, change it to `/`. Remove any `useAuth` calls solely needed to fetch `profile.activeVillageId` for that purpose. Keep tabs: `/` (Inicio), `/my-signups`, `/notifications`, `/profile`.

- [ ] **Step 2: Build**

Run: `pnpm --filter web build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/common/BottomNav.tsx
git commit -m "refactor(web): BottomNav points Inicio to / (drop village awareness)"
```

---

### Task 23: Censo nudge UX — per-village, contextual

**Files:**
- Modify: `apps/web/app/profile/page.tsx`
- Modify: `apps/web/app/village/[id]/page.tsx` (already touched in Task 18 — extend)

- [ ] **Step 1: Profile page — censo status per membership**

In `apps/web/app/profile/page.tsx`, inside the "Mis pueblos" list (Task 19), add a per-village censo status line. Use `getVillageMember(villageId, user.uid)` to read each membership doc (or include the `profileCompletedAt` in the existing `memberships` payload — extend `getUserMemberships` if needed in `villageMemberService.ts`).

Render under each village name:

```tsx
{m.profileCompletedAt ? (
  <span className="text-xs text-emerald-600">Censo completo</span>
) : (
  <Link href={`/village/${m.villageId}/censo`} className="text-xs text-amber-600 hover:underline">
    Completar censo
  </Link>
)}
```

If `getUserMemberships` does not currently return `profileCompletedAt`, extend it: read the field from the member doc and include it in the `UserMembership` type.

- [ ] **Step 2: Village page — inline censo banner for incomplete members**

In `apps/web/app/village/[id]/page.tsx` (the file from Task 18), after the existing "Eres visitante" block, add:

```tsx
{isMember && memberDoc && !memberDoc.profileCompletedAt && (
  <div className="mt-4 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm">
    Aún no has completado el censo de {village.name}.{' '}
    <Link href={`/village/${village.id}/censo`} className="underline font-medium">
      Completar ahora
    </Link>
  </div>
)}
```

To get `memberDoc`, extend the page's effect to also call `getVillageMember(villageId, user.uid)` and store in state.

- [ ] **Step 3: Build**

Run: `pnpm --filter web build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/profile/page.tsx apps/web/app/village/\[id\]/page.tsx packages/shared/src/services/villageMemberService.ts
git commit -m "feat(web): censo nudge per-village (profile list + village banner)"
```

---

## Phase 7 — Cleanup and Verification

### Task 24: Final type check, build, test

**Files:** none

- [ ] **Step 1: Build all workspaces**

Run: `pnpm -r build`
Expected: every workspace builds clean.

- [ ] **Step 2: Run all tests**

Run: `pnpm -r test`
Expected: all green.

- [ ] **Step 3: Manual smoke test in dev**

Run: `pnpm --filter web dev`

Verify in a browser:
1. Logged out → home shows feed; village links work; event links go to `/event/{id}`.
2. Logged in user with one village membership → home is feed; profile shows "Mis pueblos" with the village marked Principal; censo status visible.
3. Click an event from the feed → can sign up; attendee list shows "Vecino" for members of the event's village and "Visitante" for non-members.
4. Coordinador panel still works at `/village/{id}/admin` (untouched).
5. Create an event from `/org/{id}/events/new` — successfully creates with denormalized village fields; appears immediately in the feed.
6. Rename a village in the admin panel — within ~10s, that village's event cards in the feed reflect the new name.

- [ ] **Step 4: If any check fails, fix and re-run from Step 1**

- [ ] **Step 5: Commit any small follow-up fixes**

```bash
git add -A
git commit -m "chore: post-migration smoke fixes"
```

---

### Task 25: Delete migrated nested data (gated on user confirmation)

**Files:** none (operational)

- [ ] **Step 1: Confirm with the user before deleting**

Do not run this until the smoke test in Task 24 has passed and the user explicitly confirms. The nested copies (`villages/*/events/*`, `villages/*/organizations/*`) are otherwise harmless leftovers.

- [ ] **Step 2: Add a delete-nested mode to the migration script**

Append to `scripts/migrate-to-flat.mjs` a `--delete-nested` branch that, when both `--commit` and `--delete-nested` are set, walks the same villages and `recursiveDelete`s the nested `events` and `organizations` subcollections. Use `db.recursiveDelete(parent.collection('events'))`.

- [ ] **Step 3: Run delete in dry mode first**

Run: `node scripts/migrate-to-flat.mjs --project villa-events --delete-nested`
Expected: lists what *would* be deleted.

- [ ] **Step 4: User approves; run with `--commit --delete-nested`**

Run: `node scripts/migrate-to-flat.mjs --project villa-events --commit --delete-nested`
Expected: nested subtrees removed.

- [ ] **Step 5: Spot-check console**

Open Firestore console; confirm no `villages/{id}/events/*` or `villages/{id}/organizations/*` remain. The flat top-level `events/*` and `organizations/*` are intact.

- [ ] **Step 6: Commit any final script changes**

```bash
git add scripts/migrate-to-flat.mjs
git commit -m "chore(scripts): add --delete-nested cleanup mode"
```

---

## Self-Review Checklist (run after writing the plan)

The author has run this checklist; entries below are verifications.

**Spec coverage:**
- §1 Vision → Tasks 17 (feed) + 22 (BottomNav) + 18 (village reframe).
- §2 Data model → Tasks 1, 2 (models), 3–7 (services), 11 (migration).
- §3 Membership semantics → Task 21 (badges), Task 14/15 (org create gating via rules).
- §4 Feed and routes → Tasks 13–16 (routes), Task 17 (feed query + Cerca de mí).
- §5 Security rules → Task 9.
- §6 Migration → Tasks 11, 12, 25.
- §7 Censo's place → Task 23.
- §8 Non-goals → not implemented (correct).
- §9 Open questions → flagged in spec; revisited during implementation.

**Placeholder scan:** No "TBD", "TODO", or "implement later" outside of the explicit user-confirmation gate in Task 25. All code blocks contain the actual code.

**Type consistency:**
- `EventDataInput` in Task 1 includes `villageId`, `villageName`, `villageCoverImage?`, `villageCoordinates`. Task 3's `createEvent` takes `EventDataInput`. Task 15 builds the input from `getOrganization` + `getVillage`. Consistent.
- `OrganizationData.villageId` (Task 2) is read by `mapOrgDoc` (Task 4) and used by rules (Task 9). Consistent.
- `getUserRegistrationsAcrossVillages` was renamed to `getUserRegistrationsAcrossEvents` (Task 6); call site updated in Task 20. Consistent.
- `eventPath` shape changes from `villages/{vid}/events/{eid}` to `events/{eid}` (Task 6); parser updated in Task 20. Consistent.
- `isOrgMember(orgId, userId)` two-arg signature (Task 5); rule helper `isOrgMember(orgId)` is the rule version (auth.uid implicit). Different but unambiguous.
