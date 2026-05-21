# Village Discovery & Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple mobile signup from village selection, force a profile-creation step, add join/organizer request flows behind Cloud Function guardrails, and restructure the bottom nav to three tabs (Explora / dynamic village / Perfil) so a brand-new user can register, discover a village, and request to join or organize one.

**Architecture:** Two new Firestore collections (`municipalities/{mid}/joinRequests/{uid}` and top-level `organizerRequests/{requestId}`) written exclusively by four new Cloud Function callables that enforce identity + state guardrails. Mobile gets a new `(onboarding)/complete-profile` redirect when `users/{uid}` is missing, and the existing `(tabs)` layout is rewritten with three tabs where the middle one swaps between active-village home and a discovery screen based on `profile.activeMunicipalityId`.

**Tech Stack:** TypeScript, Firebase (Auth + Firestore + Functions), Expo SDK 54, expo-router, React Native, `@expo/vector-icons` (Ionicons — already bundled), Vitest, `@firebase/rules-unit-testing`, next-intl on web / `useT()` on mobile.

**Spec:** [docs/superpowers/specs/2026-05-21-village-discovery-onboarding-design.md](../specs/2026-05-21-village-discovery-onboarding-design.md)

---

## File map

**Create:**
- `packages/shared/src/models/municipality/JoinRequestDataModel.ts`
- `packages/shared/src/models/municipality/OrganizerRequestDataModel.ts`
- `packages/shared/src/services/joinRequestService.ts`
- `packages/shared/src/services/organizerRequestService.ts`
- `functions/src/requestJoinVillage.ts`
- `functions/src/respondToJoinRequest.ts`
- `functions/src/requestOrganizeVillage.ts`
- `functions/src/respondToOrganizerRequest.ts`
- `packages/shared/test/e2e/joinRequestRules.test.ts`
- `packages/shared/test/e2e/organizerRequestRules.test.ts`
- `apps/mobile/app/(onboarding)/_layout.tsx`
- `apps/mobile/app/(onboarding)/complete-profile.tsx`
- `apps/mobile/app/(tabs)/explora.tsx` (renamed from index.tsx)
- `apps/mobile/app/(tabs)/village.tsx`
- `apps/mobile/app/discover/request-join/[municipalityId].tsx`
- `apps/mobile/app/discover/request-organizer/[municipalityId].tsx`
- `apps/mobile/app/village/[villageId]/admin/requests.tsx`
- `apps/mobile/components/feature/VillageDiscovery.tsx`
- `apps/mobile/components/feature/VillageSwitcher.tsx`

**Modify:**
- `packages/shared/src/models/municipality/index.ts` (re-export new models)
- `packages/shared/src/services/index.ts` (re-export new services)
- `packages/shared/src/services/_services-map.md` (add rows)
- `functions/src/index.ts` (export new callables)
- `firestore.rules` (add request collections)
- `firestore.indexes.json` (add collection-group indexes)
- `apps/mobile/app/_layout.tsx` (post-auth redirect to onboarding)
- `apps/mobile/app/(tabs)/_layout.tsx` (rewrite with three tabs + icons)
- `apps/mobile/app/(tabs)/index.tsx` (delete in same commit that creates explora.tsx)
- `apps/mobile/app/(tabs)/villages.tsx` (delete — old screen replaced by village.tsx)
- `packages/i18n/messages/es.json` + counterpart locales (add new keys)

**Delete:**
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/app/(tabs)/villages.tsx`

---

## Task 1: Join request data model

**Files:**
- Create: `packages/shared/src/models/municipality/JoinRequestDataModel.ts`
- Modify: `packages/shared/src/models/municipality/index.ts`

- [ ] **Step 1: Write the model**

```ts
// packages/shared/src/models/municipality/JoinRequestDataModel.ts
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface JoinRequestData {
  userId: string;
  requestedAt: Date;
  status: JoinRequestStatus;
  message: string | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
}

export interface JoinRequestDataInput {
  userId: string;
  message?: string | null;
}

export function buildJoinRequestData(input: JoinRequestDataInput): JoinRequestData {
  return {
    userId: input.userId,
    requestedAt: new Date(),
    status: 'pending',
    message: input.message ?? null,
    reviewedAt: null,
    reviewedBy: null,
  };
}
```

- [ ] **Step 2: Re-export**

Append to `packages/shared/src/models/municipality/index.ts`:

```ts
export * from './JoinRequestDataModel';
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/models/municipality/JoinRequestDataModel.ts \
        packages/shared/src/models/municipality/index.ts
git commit -m "feat(shared): add JoinRequestData model"
```

---

## Task 2: Organizer request data model

**Files:**
- Create: `packages/shared/src/models/municipality/OrganizerRequestDataModel.ts`
- Modify: `packages/shared/src/models/municipality/index.ts`

- [ ] **Step 1: Write the model**

```ts
// packages/shared/src/models/municipality/OrganizerRequestDataModel.ts
export type OrganizerRequestStatus = 'pending' | 'approved' | 'rejected';

export interface OrganizerRequestData {
  userId: string;
  municipalityId: string;
  requestedAt: Date;
  status: OrganizerRequestStatus;
  motivation: string | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
}

export interface OrganizerRequestDataInput {
  userId: string;
  municipalityId: string;
  motivation?: string | null;
}

export function buildOrganizerRequestData(input: OrganizerRequestDataInput): OrganizerRequestData {
  return {
    userId: input.userId,
    municipalityId: input.municipalityId,
    requestedAt: new Date(),
    status: 'pending',
    motivation: input.motivation ?? null,
    reviewedAt: null,
    reviewedBy: null,
  };
}
```

- [ ] **Step 2: Re-export**

Append to `packages/shared/src/models/municipality/index.ts`:

```ts
export * from './OrganizerRequestDataModel';
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/models/municipality/OrganizerRequestDataModel.ts \
        packages/shared/src/models/municipality/index.ts
git commit -m "feat(shared): add OrganizerRequestData model"
```

---

## Task 3: Join request service

**Files:**
- Create: `packages/shared/src/services/joinRequestService.ts`
- Modify: `packages/shared/src/services/index.ts`, `packages/shared/src/services/_services-map.md`

- [ ] **Step 1: Service file**

```ts
// packages/shared/src/services/joinRequestService.ts
import {
  collection, doc, getDoc, getDocs, query, where, orderBy,
  collectionGroup, Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDb, getFirebaseFunctions } from '../firebase';
import type { JoinRequestData, JoinRequestStatus } from '../models/municipality/JoinRequestDataModel';

function reqsCol(municipalityId: string) {
  return collection(getDb(), 'municipalities', municipalityId, 'joinRequests');
}

function mapDoc(id: string, data: Record<string, unknown>): JoinRequestData & { id: string } {
  return {
    id,
    userId: data['userId'] as string,
    requestedAt: (data['requestedAt'] as Timestamp).toDate(),
    status: data['status'] as JoinRequestStatus,
    message: (data['message'] as string) ?? null,
    reviewedAt: data['reviewedAt'] ? (data['reviewedAt'] as Timestamp).toDate() : null,
    reviewedBy: (data['reviewedBy'] as string) ?? null,
  };
}

export async function getJoinRequest(
  municipalityId: string,
  userId: string,
): Promise<(JoinRequestData & { id: string }) | null> {
  const snap = await getDoc(doc(reqsCol(municipalityId), userId));
  if (!snap.exists()) return null;
  return mapDoc(snap.id, snap.data());
}

export async function getJoinRequestsForVillage(
  municipalityId: string,
  status?: JoinRequestStatus,
): Promise<(JoinRequestData & { id: string })[]> {
  const base = reqsCol(municipalityId);
  const q = status
    ? query(base, where('status', '==', status), orderBy('requestedAt', 'asc'))
    : query(base, orderBy('requestedAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDoc(d.id, d.data()));
}

export async function getMyJoinRequests(
  userId: string,
): Promise<((JoinRequestData & { id: string; municipalityId: string }))[]> {
  const q = query(
    collectionGroup(getDb(), 'joinRequests'),
    where('userId', '==', userId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const municipalityId = d.ref.parent.parent!.id;
    return { ...mapDoc(d.id, d.data()), municipalityId };
  });
}

interface RequestJoinPayload { municipalityId: string; message?: string | null }
export async function requestJoinVillage(payload: RequestJoinPayload): Promise<void> {
  const fn = httpsCallable<RequestJoinPayload, { ok: true }>(
    getFirebaseFunctions(), 'requestJoinVillage',
  );
  await fn(payload);
}

interface RespondPayload {
  municipalityId: string; userId: string; decision: 'approved' | 'rejected';
}
export async function respondToJoinRequest(payload: RespondPayload): Promise<void> {
  const fn = httpsCallable<RespondPayload, { ok: true }>(
    getFirebaseFunctions(), 'respondToJoinRequest',
  );
  await fn(payload);
}
```

- [ ] **Step 2: Re-export from `services/index.ts`**

Append:

```ts
export * from './joinRequestService';
```

- [ ] **Step 3: Add a row to `_services-map.md`**

Insert between `inviteTokenService` and `membershipProfileService`:

```md
| [joinRequestService](joinRequestService.ts) | `municipalities/{mid}/joinRequests/` + collection group | Village join requests — read your own, list per village (admins), create/respond via Cloud Function callables. | `getJoinRequest`, `getJoinRequestsForVillage`, `getMyJoinRequests`, `requestJoinVillage`, `respondToJoinRequest` |
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/services/joinRequestService.ts \
        packages/shared/src/services/index.ts \
        packages/shared/src/services/_services-map.md
git commit -m "feat(shared): add joinRequestService"
```

---

## Task 4: Organizer request service

**Files:**
- Create: `packages/shared/src/services/organizerRequestService.ts`
- Modify: `packages/shared/src/services/index.ts`, `packages/shared/src/services/_services-map.md`

- [ ] **Step 1: Service file**

```ts
// packages/shared/src/services/organizerRequestService.ts
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDb, getFirebaseFunctions } from '../firebase';
import type { OrganizerRequestData, OrganizerRequestStatus }
  from '../models/municipality/OrganizerRequestDataModel';

function reqsCol() {
  return collection(getDb(), 'organizerRequests');
}

function mapDoc(id: string, data: Record<string, unknown>): OrganizerRequestData & { id: string } {
  return {
    id,
    userId: data['userId'] as string,
    municipalityId: data['municipalityId'] as string,
    requestedAt: (data['requestedAt'] as Timestamp).toDate(),
    status: data['status'] as OrganizerRequestStatus,
    motivation: (data['motivation'] as string) ?? null,
    reviewedAt: data['reviewedAt'] ? (data['reviewedAt'] as Timestamp).toDate() : null,
    reviewedBy: (data['reviewedBy'] as string) ?? null,
  };
}

export async function getOrganizerRequest(
  id: string,
): Promise<(OrganizerRequestData & { id: string }) | null> {
  const snap = await getDoc(doc(reqsCol(), id));
  if (!snap.exists()) return null;
  return mapDoc(snap.id, snap.data());
}

export async function getPendingOrganizerRequests(): Promise<(OrganizerRequestData & { id: string })[]> {
  const q = query(reqsCol(), where('status', '==', 'pending'), orderBy('requestedAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDoc(d.id, d.data()));
}

export async function getMyOrganizerRequests(
  userId: string,
): Promise<(OrganizerRequestData & { id: string })[]> {
  const q = query(reqsCol(), where('userId', '==', userId), orderBy('requestedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDoc(d.id, d.data()));
}

interface RequestOrgPayload { municipalityId: string; motivation?: string | null }
export async function requestOrganizeVillage(payload: RequestOrgPayload): Promise<void> {
  const fn = httpsCallable<RequestOrgPayload, { ok: true }>(
    getFirebaseFunctions(), 'requestOrganizeVillage',
  );
  await fn(payload);
}

interface RespondOrgPayload { requestId: string; decision: 'approved' | 'rejected' }
export async function respondToOrganizerRequest(payload: RespondOrgPayload): Promise<void> {
  const fn = httpsCallable<RespondOrgPayload, { ok: true }>(
    getFirebaseFunctions(), 'respondToOrganizerRequest',
  );
  await fn(payload);
}
```

- [ ] **Step 2: Re-export + services map row**

Append to `services/index.ts`:

```ts
export * from './organizerRequestService';
```

Add to `_services-map.md` (alphabetically near `organizationService`):

```md
| [organizerRequestService](organizerRequestService.ts) | `organizerRequests/` | Requests to become organizer of an inactive municipality. Users create + read own; superadmin lists pending; mutations via Cloud Function. | `getOrganizerRequest`, `getPendingOrganizerRequests`, `getMyOrganizerRequests`, `requestOrganizeVillage`, `respondToOrganizerRequest` |
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/services/organizerRequestService.ts \
        packages/shared/src/services/index.ts \
        packages/shared/src/services/_services-map.md
git commit -m "feat(shared): add organizerRequestService"
```

---

## Task 5: `requestJoinVillage` Cloud Function

**Files:**
- Create: `functions/src/requestJoinVillage.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Implementation**

```ts
// functions/src/requestJoinVillage.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

interface Data { municipalityId: string; message?: string | null }

export const requestJoinVillage = onCall<Data>(async (req) => {
  const handler = 'requestJoinVillage';
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const uid = req.auth.uid;
  const { municipalityId, message } = req.data ?? ({} as Data);
  if (!municipalityId) throw new HttpsError('invalid-argument', 'municipalityId required');

  const db = getFirestore();
  const muniRef = db.doc(`municipalities/${municipalityId}`);
  const memberRef = db.doc(`municipalities/${municipalityId}/members/${uid}`);
  const reqRef = db.doc(`municipalities/${municipalityId}/joinRequests/${uid}`);

  await db.runTransaction(async (tx) => {
    const [muni, member, existing] = await Promise.all([
      tx.get(muniRef), tx.get(memberRef), tx.get(reqRef),
    ]);
    if (!muni.exists) throw new HttpsError('not-found', 'Municipality not found');
    if (muni.get('communityActive') !== true)
      throw new HttpsError('failed-precondition', 'Community not active');
    if (member.exists) throw new HttpsError('already-exists', 'Already a member');
    if (existing.exists && existing.get('status') === 'pending')
      throw new HttpsError('already-exists', 'Request already pending');

    tx.set(reqRef, {
      userId: uid,
      requestedAt: FieldValue.serverTimestamp(),
      status: 'pending',
      message: message ?? null,
      reviewedAt: null,
      reviewedBy: null,
    });
  });

  logger.info('join request created', { handler, uid, municipalityId });
  return { ok: true as const };
});
```

- [ ] **Step 2: Wire into `functions/src/index.ts`**

Add at the end:

```ts
export { requestJoinVillage } from './requestJoinVillage';
```

- [ ] **Step 3: Commit**

```bash
git add functions/src/requestJoinVillage.ts functions/src/index.ts
git commit -m "feat(functions): requestJoinVillage callable"
```

---

## Task 6: `respondToJoinRequest` Cloud Function

**Files:**
- Create: `functions/src/respondToJoinRequest.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Implementation**

```ts
// functions/src/respondToJoinRequest.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

interface Data {
  municipalityId: string;
  userId: string;
  decision: 'approved' | 'rejected';
}

export const respondToJoinRequest = onCall<Data>(async (req) => {
  const handler = 'respondToJoinRequest';
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const callerUid = req.auth.uid;
  const { municipalityId, userId, decision } = req.data ?? ({} as Data);
  if (!municipalityId || !userId || (decision !== 'approved' && decision !== 'rejected'))
    throw new HttpsError('invalid-argument', 'Invalid arguments');

  const db = getFirestore();
  const reqRef = db.doc(`municipalities/${municipalityId}/joinRequests/${userId}`);
  const callerMember = db.doc(`municipalities/${municipalityId}/members/${callerUid}`);
  const muniRef = db.doc(`municipalities/${municipalityId}`);
  const memberRef = db.doc(`municipalities/${municipalityId}/members/${userId}`);
  const adminDoc = db.doc(`admins/${callerUid}`);

  await db.runTransaction(async (tx) => {
    const [callerSnap, muniSnap, reqSnap, appAdminSnap] = await Promise.all([
      tx.get(callerMember), tx.get(muniRef), tx.get(reqRef), tx.get(adminDoc),
    ]);
    const isVillageAdmin = callerSnap.exists && callerSnap.get('role') === 'admin';
    const communityAdmin = muniSnap.get('community.adminUserId') === callerUid;
    const isAppAdmin = appAdminSnap.exists;
    if (!(isVillageAdmin || communityAdmin || isAppAdmin))
      throw new HttpsError('permission-denied', 'Not authorized');
    if (!reqSnap.exists) throw new HttpsError('not-found', 'Request not found');
    if (reqSnap.get('status') !== 'pending')
      throw new HttpsError('failed-precondition', 'Request already resolved');

    tx.update(reqRef, {
      status: decision,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: callerUid,
    });
    if (decision === 'approved') {
      tx.set(memberRef, {
        userId,
        role: 'user',
        joinedAt: FieldValue.serverTimestamp(),
        profileAnswers: {},
        profileCompletedAt: null,
      });
    }
  });

  logger.info('join request resolved', { handler, municipalityId, userId, decision });
  return { ok: true as const };
});
```

- [ ] **Step 2: Wire export**

Append to `functions/src/index.ts`:

```ts
export { respondToJoinRequest } from './respondToJoinRequest';
```

- [ ] **Step 3: Commit**

```bash
git add functions/src/respondToJoinRequest.ts functions/src/index.ts
git commit -m "feat(functions): respondToJoinRequest callable"
```

---

## Task 7: `requestOrganizeVillage` Cloud Function

**Files:**
- Create: `functions/src/requestOrganizeVillage.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Implementation**

```ts
// functions/src/requestOrganizeVillage.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

interface Data { municipalityId: string; motivation?: string | null }

export const requestOrganizeVillage = onCall<Data>(async (req) => {
  const handler = 'requestOrganizeVillage';
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const uid = req.auth.uid;
  const { municipalityId, motivation } = req.data ?? ({} as Data);
  if (!municipalityId) throw new HttpsError('invalid-argument', 'municipalityId required');

  const db = getFirestore();
  const muniRef = db.doc(`municipalities/${municipalityId}`);
  const muni = await muniRef.get();
  if (!muni.exists) throw new HttpsError('not-found', 'Municipality not found');
  if (muni.get('communityActive') === true)
    throw new HttpsError('failed-precondition', 'Community already active');

  const dup = await db.collection('organizerRequests')
    .where('userId', '==', uid)
    .where('municipalityId', '==', municipalityId)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  if (!dup.empty) throw new HttpsError('already-exists', 'Pending request exists');

  const ref = db.collection('organizerRequests').doc();
  await ref.set({
    userId: uid,
    municipalityId,
    requestedAt: FieldValue.serverTimestamp(),
    status: 'pending',
    motivation: motivation ?? null,
    reviewedAt: null,
    reviewedBy: null,
  });

  logger.info('organizer request created', { handler, uid, municipalityId, requestId: ref.id });
  return { ok: true as const, requestId: ref.id };
});
```

- [ ] **Step 2: Wire export**

Append to `functions/src/index.ts`:

```ts
export { requestOrganizeVillage } from './requestOrganizeVillage';
```

- [ ] **Step 3: Commit**

```bash
git add functions/src/requestOrganizeVillage.ts functions/src/index.ts
git commit -m "feat(functions): requestOrganizeVillage callable"
```

---

## Task 8: `respondToOrganizerRequest` Cloud Function

**Files:**
- Create: `functions/src/respondToOrganizerRequest.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Implementation**

```ts
// functions/src/respondToOrganizerRequest.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

interface Data { requestId: string; decision: 'approved' | 'rejected' }

export const respondToOrganizerRequest = onCall<Data>(async (req) => {
  const handler = 'respondToOrganizerRequest';
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const callerUid = req.auth.uid;
  const { requestId, decision } = req.data ?? ({} as Data);
  if (!requestId || (decision !== 'approved' && decision !== 'rejected'))
    throw new HttpsError('invalid-argument', 'Invalid arguments');

  const db = getFirestore();
  const adminSnap = await db.doc(`admins/${callerUid}`).get();
  if (!adminSnap.exists) throw new HttpsError('permission-denied', 'App admin only');

  const reqRef = db.doc(`organizerRequests/${requestId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(reqRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Request not found');
    if (snap.get('status') !== 'pending')
      throw new HttpsError('failed-precondition', 'Already resolved');

    const requesterUid = snap.get('userId') as string;
    const municipalityId = snap.get('municipalityId') as string;
    const muniRef = db.doc(`municipalities/${municipalityId}`);
    const muni = await tx.get(muniRef);
    if (!muni.exists) throw new HttpsError('not-found', 'Municipality missing');
    if (muni.get('communityActive') === true && decision === 'approved')
      throw new HttpsError('failed-precondition', 'Community already active');

    tx.update(reqRef, {
      status: decision,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: callerUid,
    });

    if (decision === 'approved') {
      tx.update(muniRef, {
        communityActive: true,
        community: {
          description: '',
          coverImages: [],
          adminUserId: requesterUid,
          profileForm: null,
          activatedAt: FieldValue.serverTimestamp(),
        },
      });
      tx.set(db.doc(`municipalities/${municipalityId}/members/${requesterUid}`), {
        userId: requesterUid,
        role: 'admin',
        joinedAt: FieldValue.serverTimestamp(),
        profileAnswers: {},
        profileCompletedAt: null,
      });
    }
  });

  logger.info('organizer request resolved', { handler, requestId, decision });
  return { ok: true as const };
});
```

- [ ] **Step 2: Wire export**

Append to `functions/src/index.ts`:

```ts
export { respondToOrganizerRequest } from './respondToOrganizerRequest';
```

- [ ] **Step 3: Commit**

```bash
git add functions/src/respondToOrganizerRequest.ts functions/src/index.ts
git commit -m "feat(functions): respondToOrganizerRequest callable"
```

---

## Task 9: Firestore rules + indexes

**Files:** Modify `firestore.rules`, `firestore.indexes.json`.

- [ ] **Step 1: Rules — joinRequests subcollection**

Inside the `match /municipalities/{municipalityId}` block (after `members`), add:

```
match /joinRequests/{userId} {
  allow read: if isOwner(userId) || isVillageAdmin(municipalityId) || isAppAdmin();
  allow create, update, delete: if false; // Cloud Functions only
}
```

- [ ] **Step 2: Rules — organizerRequests top-level**

After the `municipalities/{municipalityId}` match block, add:

```
match /organizerRequests/{requestId} {
  allow read: if isAuthenticated() &&
    (resource.data.userId == request.auth.uid || isAppAdmin());
  allow create, update, delete: if false;
}
```

- [ ] **Step 3: Indexes — collection group + organizerRequests**

Add entries to the `indexes` array in `firestore.indexes.json`:

```json
{
  "collectionGroup": "joinRequests",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "organizerRequests",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "organizerRequests",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "requestedAt", "order": "ASCENDING" }
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add firestore.rules firestore.indexes.json
git commit -m "feat(firestore): rules + indexes for join/organizer requests"
```

---

## Task 10: i18n strings

**Files:** Modify `packages/i18n/messages/es.json` (and any other locale files present in the repo).

- [ ] **Step 1: Add keys**

Merge into the existing JSON:

```json
{
  "tabs": {
    "explora": "Explora",
    "village": "Pueblo",
    "findVillage": "Buscar pueblo",
    "profile": "Perfil"
  },
  "onboarding": {
    "completeProfile": {
      "title": "Completa tu perfil",
      "displayName": "Nombre",
      "birthday": "Fecha de nacimiento",
      "telephone": "Teléfono (opcional)",
      "submit": "Continuar",
      "error": "No se pudo guardar el perfil"
    }
  },
  "discover": {
    "search": "Busca tu pueblo",
    "empty": "No hay pueblos activos todavía",
    "notSeeing": "¿No ves tu pueblo?",
    "requestJoin": "Solicitar acceso",
    "requestOrganizer": "Quiero organizar este pueblo"
  },
  "requests": {
    "status": {
      "pending": "Pendiente",
      "approved": "Aprobada",
      "rejected": "Rechazada"
    },
    "join": {
      "title": "Solicitar acceso",
      "messageLabel": "Mensaje (opcional)",
      "submit": "Enviar solicitud",
      "submitted": "Solicitud enviada"
    },
    "organizer": {
      "title": "Solicitar ser organizador",
      "motivationLabel": "¿Por qué quieres organizar este pueblo?",
      "submit": "Enviar solicitud",
      "submitted": "Solicitud enviada"
    },
    "admin": {
      "title": "Solicitudes pendientes",
      "approve": "Aprobar",
      "reject": "Rechazar"
    }
  },
  "villageSwitcher": {
    "title": "Cambiar de pueblo",
    "findAnother": "Buscar otro pueblo"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/i18n/messages
git commit -m "feat(i18n): strings for discovery + onboarding flows"
```

---

## Task 11: Onboarding — complete-profile screen

**Files:**
- Create: `apps/mobile/app/(onboarding)/_layout.tsx`, `apps/mobile/app/(onboarding)/complete-profile.tsx`
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Onboarding layout**

```tsx
// apps/mobile/app/(onboarding)/_layout.tsx
import { Stack } from 'expo-router';
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: complete-profile screen**

```tsx
// apps/mobile/app/(onboarding)/complete-profile.tsx
import { useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Screen, VStack, Text, Input, Button } from '../../components/primitives';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { createUserProfile } from '@cultuvilla/shared/services/userService';

export default function CompleteProfileScreen() {
  const { user, refreshProfile } = useAuth();
  const { t } = useT();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [birthday, setBirthday] = useState<Date>(new Date(1990, 0, 1));
  const [telephone, setTelephone] = useState('');
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!user) return;
    setError(null); setLoading(true);
    try {
      await createUserProfile(user.uid, {
        displayName: displayName.trim(),
        email: user.email ?? '',
        birthday,
        telephone: telephone.trim() || null,
      });
      await refreshProfile();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('onboarding.completeProfile.error'));
    } finally { setLoading(false); }
  }

  return (
    <Screen>
      <VStack gap={4}>
        <Text variant="h2">{t('onboarding.completeProfile.title')}</Text>
        <Input
          label={t('onboarding.completeProfile.displayName')}
          value={displayName}
          onChangeText={setDisplayName}
        />
        <Button variant="secondary" onPress={() => setShowPicker(true)}>
          {`${t('onboarding.completeProfile.birthday')}: ${birthday.toLocaleDateString()}`}
        </Button>
        {showPicker && (
          <DateTimePicker
            value={birthday}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(_, d) => {
              if (Platform.OS !== 'ios') setShowPicker(false);
              if (d) setBirthday(d);
            }}
            maximumDate={new Date()}
          />
        )}
        <Input
          label={t('onboarding.completeProfile.telephone')}
          value={telephone}
          onChangeText={setTelephone}
          keyboardType="phone-pad"
        />
        {error && <Text tone="danger">{error}</Text>}
        <Button onPress={onSubmit} loading={loading} fullWidth>
          <Text tone="onAccent">{t('onboarding.completeProfile.submit')}</Text>
        </Button>
      </VStack>
    </Screen>
  );
}
```

If `@react-native-community/datetimepicker` isn't installed yet, install it with `pnpm --filter mobile add @react-native-community/datetimepicker` and re-run the Expo prebuild (per [expo-native-rebuild]). If installing is undesirable, fall back to three numeric Input fields (DD/MM/YYYY) and build the date in `onSubmit` — adjust the component accordingly.

- [ ] **Step 3: Update root `_layout.tsx` to redirect when profile is missing**

Replace the `AuthGate` component body with:

```tsx
import { Redirect, Stack } from 'expo-router';
// ...
function AuthGate() {
  const { user, loading, profile, profileChecked } = useAuth();
  if (loading || (user && !profileChecked)) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }
  if (user && profileChecked && !profile) {
    return <Redirect href="/(onboarding)/complete-profile" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(onboarding) apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): complete-profile onboarding step"
```

---

## Task 12: Three-tab layout with icons

**Files:**
- Create: `apps/mobile/app/(tabs)/explora.tsx`, `apps/mobile/app/(tabs)/village.tsx`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`
- Delete: `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/(tabs)/villages.tsx`

- [ ] **Step 1: Move feed into explora.tsx**

Move the current contents of `apps/mobile/app/(tabs)/index.tsx` into `apps/mobile/app/(tabs)/explora.tsx` unchanged.

- [ ] **Step 2: New village.tsx (state machine)**

```tsx
// apps/mobile/app/(tabs)/village.tsx
import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { Screen } from '../../components/primitives';
import { useAuth } from '../../lib/auth/useAuth';
import { getUserMemberships } from '@cultuvilla/shared/services/villageMemberService';
import { setActiveMunicipality } from '@cultuvilla/shared/services/userService';
import { VillageDiscovery } from '../../components/feature/VillageDiscovery';

export default function VillageTabScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!user || !profile) { setResolving(false); return; }
      if (profile.activeMunicipalityId) { setResolving(false); return; }
      const memberships = await getUserMemberships(user.uid);
      if (cancelled) return;
      if (memberships.length > 0) {
        await setActiveMunicipality(user.uid, memberships[0].municipalityId);
        await refreshProfile();
      }
      setResolving(false);
    }
    void resolve();
    return () => { cancelled = true; };
  }, [user, profile, refreshProfile]);

  if (resolving) {
    return <Screen><ActivityIndicator /></Screen>;
  }
  if (profile?.activeMunicipalityId) {
    return <Redirect href={`/village/${profile.activeMunicipalityId}`} />;
  }
  return <VillageDiscovery />;
}
```

- [ ] **Step 3: Rewrite `(tabs)/_layout.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';

export default function TabsLayout() {
  const { user, loading, profile } = useAuth();
  const { t } = useT();
  const [activeName, setActiveName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = profile?.activeMunicipalityId;
    if (!id) { setActiveName(null); return; }
    getMunicipality(id).then((m) => { if (!cancelled) setActiveName(m?.name ?? null); });
    return () => { cancelled = true; };
  }, [profile?.activeMunicipalityId]);

  if (loading) return null;
  if (!user) return <Redirect href="/login" />;

  const middleLabel = activeName ?? t('tabs.findVillage');
  const middleIcon = activeName ? 'home-outline' : 'search-outline';

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="explora"
        options={{
          title: t('tabs.explora'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="village"
        options={{
          title: middleLabel,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={middleIcon} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 4: Delete old screens**

```bash
git rm apps/mobile/app/(tabs)/index.tsx apps/mobile/app/(tabs)/villages.tsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(tabs)
git commit -m "feat(mobile): 3-tab nav with dynamic village tab + icons"
```

---

## Task 13: VillageDiscovery component

**Files:** Create `apps/mobile/components/feature/VillageDiscovery.tsx`.

- [ ] **Step 1: Component**

```tsx
// apps/mobile/components/feature/VillageDiscovery.tsx
import { useEffect, useMemo, useState } from 'react';
import { FlatList, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Screen, VStack, Text, Input, Button } from '../primitives';
import { useT } from '../../lib/i18n';
import { useAuth } from '../../lib/auth/useAuth';
import {
  getActiveCommunities, getMunicipalities,
} from '@cultuvilla/shared/services/municipalityService';
import { getMyJoinRequests } from '@cultuvilla/shared/services/joinRequestService';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality';

type Muni = MunicipalityData & { id: string };

export function VillageDiscovery() {
  const { user } = useAuth();
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<Muni[] | null>(null);
  const [all, setAll] = useState<Muni[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getActiveCommunities().then((rs) => setActive(rs));
    if (user) {
      getMyJoinRequests(user.uid).then((rs) =>
        setPendingIds(new Set(rs.filter((r) => r.status === 'pending').map((r) => r.municipalityId))),
      );
    }
  }, [user]);

  useEffect(() => {
    if (showAll && !all) getMunicipalities().then(setAll);
  }, [showAll, all]);

  const data = useMemo(() => {
    const src = showAll ? all : active;
    if (!src) return [];
    if (!query.trim()) return src;
    const q = query.toLowerCase();
    return src.filter((m) => m.name.toLowerCase().includes(q));
  }, [showAll, all, active, query]);

  if ((showAll ? all : active) === null) {
    return <Screen><ActivityIndicator /></Screen>;
  }

  return (
    <Screen padded={false}>
      <VStack gap={3} className="p-4">
        <Input
          label={t('discover.search')}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </VStack>
      <FlatList
        data={data}
        keyExtractor={(m) => m.id}
        contentContainerClassName="px-4 pb-8 gap-3"
        ListEmptyComponent={<Text tone="muted">{t('discover.empty')}</Text>}
        ListFooterComponent={
          !showAll ? (
            <Button variant="ghost" onPress={() => setShowAll(true)}>
              {t('discover.notSeeing')}
            </Button>
          ) : null
        }
        renderItem={({ item }) => {
          const isActive = item.communityActive;
          const isPending = pendingIds.has(item.id);
          const target = isActive
            ? `/discover/request-join/${item.id}`
            : `/discover/request-organizer/${item.id}`;
          return (
            <Button
              variant="secondary"
              onPress={() => router.push(target)}
              disabled={isPending}
            >
              <VStack>
                <Text>{item.name}</Text>
                <Text tone="muted">
                  {isPending
                    ? t('requests.status.pending')
                    : isActive
                    ? t('discover.requestJoin')
                    : t('discover.requestOrganizer')}
                </Text>
              </VStack>
            </Button>
          );
        }}
      />
    </Screen>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/feature/VillageDiscovery.tsx
git commit -m "feat(mobile): VillageDiscovery component"
```

---

## Task 14: Request screens (join + organizer)

**Files:**
- Create: `apps/mobile/app/discover/request-join/[municipalityId].tsx`
- Create: `apps/mobile/app/discover/request-organizer/[municipalityId].tsx`

- [ ] **Step 1: request-join**

```tsx
// apps/mobile/app/discover/request-join/[municipalityId].tsx
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, VStack, Text, Input, Button } from '../../../components/primitives';
import { useT } from '../../../lib/i18n';
import { requestJoinVillage } from '@cultuvilla/shared/services/joinRequestService';

export default function RequestJoinScreen() {
  const { municipalityId } = useLocalSearchParams<{ municipalityId: string }>();
  const { t } = useT();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null); setLoading(true);
    try {
      await requestJoinVillage({ municipalityId: municipalityId!, message: message || null });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    } finally { setLoading(false); }
  }

  return (
    <Screen>
      <VStack gap={4}>
        <Text variant="h2">{t('requests.join.title')}</Text>
        <Input
          label={t('requests.join.messageLabel')}
          value={message}
          onChangeText={setMessage}
          multiline
        />
        {error && <Text tone="danger">{error}</Text>}
        <Button onPress={onSubmit} loading={loading} fullWidth>
          <Text tone="onAccent">{t('requests.join.submit')}</Text>
        </Button>
      </VStack>
    </Screen>
  );
}
```

- [ ] **Step 2: request-organizer**

```tsx
// apps/mobile/app/discover/request-organizer/[municipalityId].tsx
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, VStack, Text, Input, Button } from '../../../components/primitives';
import { useT } from '../../../lib/i18n';
import { requestOrganizeVillage } from '@cultuvilla/shared/services/organizerRequestService';

export default function RequestOrganizerScreen() {
  const { municipalityId } = useLocalSearchParams<{ municipalityId: string }>();
  const { t } = useT();
  const [motivation, setMotivation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null); setLoading(true);
    try {
      await requestOrganizeVillage({ municipalityId: municipalityId!, motivation: motivation || null });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    } finally { setLoading(false); }
  }

  return (
    <Screen>
      <VStack gap={4}>
        <Text variant="h2">{t('requests.organizer.title')}</Text>
        <Input
          label={t('requests.organizer.motivationLabel')}
          value={motivation}
          onChangeText={setMotivation}
          multiline
        />
        {error && <Text tone="danger">{error}</Text>}
        <Button onPress={onSubmit} loading={loading} fullWidth>
          <Text tone="onAccent">{t('requests.organizer.submit')}</Text>
        </Button>
      </VStack>
    </Screen>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/discover
git commit -m "feat(mobile): request-join + request-organizer screens"
```

---

## Task 15: Village admin requests panel

**Files:** Create `apps/mobile/app/village/[villageId]/admin/requests.tsx`.

- [ ] **Step 1: Screen**

```tsx
// apps/mobile/app/village/[villageId]/admin/requests.tsx
import { useEffect, useState } from 'react';
import { FlatList, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, VStack, HStack, Text, Button } from '../../../../components/primitives';
import { useT } from '../../../../lib/i18n';
import { useAuth } from '../../../../lib/auth/useAuth';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';
import {
  getJoinRequestsForVillage,
  respondToJoinRequest,
} from '@cultuvilla/shared/services/joinRequestService';
import type { JoinRequestData } from '@cultuvilla/shared/models/municipality';

type Row = JoinRequestData & { id: string };

export default function VillageAdminRequestsScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { user } = useAuth();
  const { t } = useT();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !villageId) return;
    isVillageAdmin(villageId, user.uid).then(setAllowed);
  }, [user, villageId]);

  async function load() {
    if (!villageId) return;
    const r = await getJoinRequestsForVillage(villageId, 'pending');
    setRows(r);
  }
  useEffect(() => { if (allowed) void load(); }, [allowed, villageId]);

  async function decide(userId: string, decision: 'approved' | 'rejected') {
    if (!villageId) return;
    setBusyId(userId);
    try {
      await respondToJoinRequest({ municipalityId: villageId, userId, decision });
      await load();
    } finally { setBusyId(null); }
  }

  if (allowed === null) return <Screen><ActivityIndicator /></Screen>;
  if (!allowed) return <Screen><Text tone="danger">403</Text></Screen>;

  return (
    <Screen padded={false}>
      <FlatList
        data={rows ?? []}
        keyExtractor={(r) => r.id}
        contentContainerClassName="p-4 gap-3"
        ListHeaderComponent={<Text variant="h2">{t('requests.admin.title')}</Text>}
        ListEmptyComponent={<Text tone="muted">—</Text>}
        renderItem={({ item }) => (
          <VStack gap={2} className="p-3 border rounded-md">
            <Text>{item.userId}</Text>
            {item.message && <Text tone="muted">{item.message}</Text>}
            <HStack gap={2}>
              <Button
                onPress={() => decide(item.userId, 'approved')}
                loading={busyId === item.userId}
              >
                {t('requests.admin.approve')}
              </Button>
              <Button
                variant="ghost"
                onPress={() => decide(item.userId, 'rejected')}
                loading={busyId === item.userId}
              >
                {t('requests.admin.reject')}
              </Button>
            </HStack>
          </VStack>
        )}
      />
    </Screen>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/village/[villageId]/admin
git commit -m "feat(mobile): village admin join-request review screen"
```

---

## Task 16: Verification

- [ ] **Step 1: Typecheck + lint**

```bash
pnpm -w check
```

Expected: zero errors. Fix any TypeScript or lint errors in the just-touched files before moving on.

- [ ] **Step 2: Run shared package tests**

```bash
pnpm --filter @cultuvilla/shared test
```

Expected: pre-existing tests still green; no test added in this plan (rules/function tests are deferred per scope).

- [ ] **Step 3: Functions build**

```bash
pnpm --filter functions build
```

Expected: clean TS build for all four new callables.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "chore: verification fixes"
```

---

## Scope deferred (called out, not in this plan)

- Rules-unit-tests for the new collections (per spec) — should be a follow-up because the repo's rules test harness scaffolding (`packages/shared/test/e2e/`) needs the exact fixture pattern of the existing files, which isn't visible from the current task without an extra exploration pass.
- Cloud Function emulator tests for the four callables — same reason; follow-up.
- Notifications via `notificationService` on each state transition — straightforward additive change once the core flows are deployed and verified.
- Web admin UI for organizer-request review — out of scope; mobile-only for now.

These are intentional omissions so this plan stays a single deployable increment. Track them as follow-ups in a separate plan.
