# Solicitudes — request taxonomy + admin inbox

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan also leans on repo skills: `add-firestore-collection`, `guardrail-enforcement`, `cloud-function-logging`, `firebase-admin-dev`, `firestore-deploy`, `i18n-add-string`.

**Goal:** Name the three canonical user requests (organizer, org-creation, join-org), add the missing join-org request type backed by a new collection + approval callable, give orgs an internal admin role, and surface a role-scoped **Solicitudes** inbox to approvers only.

**Architecture:** Three Firestore-backed request types. Two already exist (`/organizerRequests`, `/organizations` with `status:'pending'`); this plan adds `/organizationJoinRequests` plus an org-member `role` field. Cross-user / trust-sensitive writes (join approval, organizer approval) run through Cloud Function callables; village-admin org-creation approval stays a rules-gated client write. The inbox is a mobile screen gated to village admins, org admins, and super admins.

**Tech Stack:** TypeScript, Zod (schema source of truth), Firebase (Firestore + callable Functions v2), `@firebase/rules-unit-testing` + vitest for rules, Expo / React Native + NativeWind for the mobile UI, next-intl/`useT()` for i18n.

## Global Constraints

- **Zod schema is the source of truth.** Every model field is `z.infer`-derived; no `any` at boundaries.
- **No raw `collection()` / `db.collection()` outside `packages/shared/src/firebase/refs/`.** `scripts/check-no-raw-firestore-refs.mjs` fails the build otherwise. The only exception is an inline `updateDoc(doc(getDb(), '<col>', id), partial)` on a single line.
- **Rules shape predicates mirror the Zod schema** (`keys().hasOnly([...]) && keys().hasAll([...])` + type checks). Rules are the only defense against direct console writes.
- **Cloud Function logging:** in `functions/src/**` use `logger.info(msg, { handler, ...fields })`, never `console.*` (the no-console test fails the build). Each handler passes a `handler` field.
- **Notifications reuse the existing enum** in `NotificationDataModel.ts`: `join_request_created | join_request_approved | join_request_rejected` already exist — wire them, do **not** add new members.
- **i18n:** every user-facing string goes through the shared catalog (`packages/i18n/`) consumed via `useT()` on mobile. No hardcoded Spanish in app UI.
- **Deploys:** rules + indexes + functions changes require a dev deploy via the `firestore-deploy` skill; indexes build asynchronously. Note the deploy in the PR description.

---

## Context

The app already has two request flows, unnamed as a family and with no shared approver surface:

- **Organizer request** — `/organizerRequests` (top-level). A user asks to become the organizer/admin of a village. App admins approve via the `respondToOrganizerRequest` callable.
- **Organization request** — a `/organizations/{id}` doc with `status: 'pending'` *is* the request. Village admins or app admins approve via the rules-gated client services `approveOrganization` / `rejectOrganization`.

A third type is half-present: `NotificationTypeSchema` already carries `join_request_created | join_request_approved | join_request_rejected`, but nothing backs it. This plan implements it.

Org membership today is **flat**: `/organizations/{orgId}/members/{userId}` is `{ joinedAt }`; any member can add others; removal is self/village-admin/app-admin only. There is no org-internal authority — the gap that motivates the `role` field below.

## Design (resolved)

### The taxonomy (3 types)

| # | Request | Created by | Created from | Approved by |
|---|---|---|---|---|
| 1 | Organizer request — be the pueblo's organizer | any user | village screen | super admin |
| 2 | Organization request — create peña/asociación/ayuntamiento | village member | village/orgs screen | village admin (own village) or super admin |
| 3 | **Join-org request** *(new)* — join a peña/asociación | any authed non-member | org screen | org admin (of that org) or super admin |

The Solicitudes button **receives** requests; it does not launch them. Non-admins never see it and create requests from existing in-context entry points; outcomes ride existing per-user notifications.

### Org-admin role

- `/organizations/{orgId}/members/{userId}` gains `role: 'admin' | 'member'` (default `'member'`).
- On org **approval**, the org's `requestedBy` creator is seeded as a member with `role: 'admin'`.
- Org admin can: approve/reject join requests, remove members, promote/demote members. Regular member can only leave. Village/app admin remain backstop.
- Rules add `isOrgAdmin(orgId)`; the member-doc `update` rule (today `false`) opens only for `role` changes by an org admin / backstop.

### Join-org request flow

- New top-level `/organizationJoinRequests/{id}`: `{ userId, orgId, municipalityId, status, requestedAt, reviewedAt, reviewedBy }` (mirrors `OrganizerRequest`).
- `requestJoinOrganization` callable creates it (rejects if already a member or a pending request exists). `respondToJoinRequest` callable, in one transaction, flips status and (on approve) writes the member doc (`role:'member'`). Notifications via the existing enum.
- Reads gated to `isOrgAdmin(orgId) || isAppAdmin()` + the requester's own.

### Inbox routing / visibility

- Button shown only to a village admin, org admin, or super admin (union if multiple).
- Super admin → all pending of all 3 types, all villages. Village admin → org-creation requests for their village. Org admin → join requests for orgs they administer.
- **Org-admin inbox query (resolved):** resolve the user's admin-org ids client-side (orgs in their active municipality whose membership `role === 'admin'`), then `where('orgId','in', adminOrgIds) && where('status','==','pending')`. The Firestore `in` cap of 30 is acceptable (an org admin won't administer 30 orgs in one village); if `adminOrgIds` is empty, skip the query.

## Out of scope

- Self-service "request to join a pueblo" — village membership stays invite/admin-add.
- A standalone requester outbox UI — status rides on notifications.
- **Cross-notifying the village admin on org-creation approval** — keep requester-only notifications (resolved: no change).
- Org-member management screen polish beyond what the inbox needs.

---

## File Structure

**Create**
- `packages/shared/src/models/organizationJoinRequest/OrganizationJoinRequestDataModel.ts` — Zod schema + `build…` factory.
- `packages/shared/src/models/organizationJoinRequest/index.ts` — re-export.
- `packages/shared/src/firebase/converters/organizationJoinRequestConverter.ts` — client + admin converters.
- `packages/shared/src/services/organizationJoinRequestService.ts` — client reads + `requestJoinOrganization` / `respondToJoinRequest` callable wrappers.
- `functions/src/organizations/requestJoinOrganization.ts` — create-request callable.
- `functions/src/organizations/respondToJoinRequest.ts` — approve/reject callable (transaction).
- `packages/shared/test/services/organizationJoinRequestService.test.ts` — service vitest.
- `packages/shared/test/e2e/organizationJoinRequestRules.test.ts` — auth rules e2e.
- `apps/mobile/lib/auth/useApproverStatus.ts` — hook: is the user a village admin / org admin / super admin + the data the inbox needs.
- `apps/mobile/app/solicitudes/index.tsx` — the inbox screen.
- `scripts/backfill-org-member-roles.mjs` — one-off backfill (creator → admin, others → member).

**Modify**
- `packages/shared/src/models/organization/OrgMemberDataModel.ts` — add `role`.
- `packages/shared/src/models/index.ts` — add join-request export.
- `packages/shared/src/firebase/refs/client.ts` + `admin.ts` — add join-request ref factories.
- `packages/shared/src/services/orgMemberService.ts` — `addOrgMember(orgId, userId, role?)`, `setOrgMemberRole`, `getOrgAdminIds`.
- `packages/shared/src/services/index.ts` — export new service.
- `packages/shared/src/services/_services-map.md` — add a row.
- `firestore.rules` — `isOrgAdmin` helper, org-member shape + create/update/delete, `/organizationJoinRequests` block + shape predicate.
- `firestore.indexes.json` — composite indexes for join-request queries.
- `functions/src/index.ts` — export the two new callables.
- `functions/src/helpers/notifyRequests.ts` — join-request notification helpers.
- `apps/mobile/components/feature/UserMenuModal.tsx` — Solicitudes menu entry, gated.
- `packages/i18n/` — new `solicitudes.*` strings.
- `AGENTS.md` — taxonomy section.

---

## Tasks

### Task 0: Document the request taxonomy in AGENTS.md

**Files:** Modify `AGENTS.md`.

- [ ] **Step 1: Add a "Request types (solicitudes)" subsection** under the domain/architecture area (place it near the existing collections/architecture discussion). Content:

```markdown
### Request types (solicitudes)

Three user-initiated requests exist. Approvers see them in the Solicitudes inbox
(mobile, admin-only). Non-admins create requests from in-context screens; outcomes
arrive as notifications.

| Request | Collection | Created by | Approved by |
|---|---|---|---|
| Organizer (be the pueblo's organizer) | `organizerRequests/` | any user | super admin (`respondToOrganizerRequest` callable) |
| Organization (create peña/asociación/ayuntamiento) | `organizations/` (status `pending`) | village member | village admin (own village) or super admin (`approveOrganization`/`rejectOrganization`) |
| Join org (join a peña/asociación) | `organizationJoinRequests/` | any authed non-member | org admin or super admin (`respondToJoinRequest` callable) |

Org membership has a `role: 'admin' | 'member'`. Org admins approve join requests,
remove members, and promote/demote; the `requestedBy` creator is seeded as admin on
org approval. Village/app admins are the backstop.
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): document the three request types + org-admin role"
```

---

### Task 1: Add `role` to the org-member model

**Files:**
- Modify: `packages/shared/src/models/organization/OrgMemberDataModel.ts`
- Test: `packages/shared/test/models/orgMemberModel.test.ts` (create)

**Interfaces:**
- Produces: `OrgMemberData = { joinedAt: Date; role: 'admin' | 'member' }`; `buildOrgMemberData(input?: { joinedAt?: Date; role?: OrgMemberRole }): OrgMemberData`; `OrgMemberRole = 'admin' | 'member'`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/test/models/orgMemberModel.test.ts
import { describe, it, expect } from 'vitest';
import {
  OrgMemberDataSchema,
  buildOrgMemberData,
} from '../../src/models/organization/OrgMemberDataModel';

describe('OrgMemberDataModel', () => {
  it('defaults role to "member"', () => {
    const m = buildOrgMemberData();
    expect(m.role).toBe('member');
  });

  it('accepts an explicit admin role', () => {
    expect(buildOrgMemberData({ role: 'admin' }).role).toBe('admin');
  });

  it('parses a legacy doc without role as member (default)', () => {
    const parsed = OrgMemberDataSchema.parse({ joinedAt: new Date() });
    expect(parsed.role).toBe('member');
  });

  it('rejects an unknown role', () => {
    expect(() =>
      OrgMemberDataSchema.parse({ joinedAt: new Date(), role: 'owner' }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `pnpm --filter @cultuvilla/shared test -- orgMemberModel`
Expected: FAIL (`role` undefined / not on schema).

- [ ] **Step 3: Implement**

```ts
// packages/shared/src/models/organization/OrgMemberDataModel.ts
import { z } from 'zod';

export const OrgMemberRoleSchema = z.enum(['admin', 'member']);
export type OrgMemberRole = z.infer<typeof OrgMemberRoleSchema>;

export const OrgMemberDataSchema = z.object({
  joinedAt: z.date(),
  /** `.default('member')` keeps members written before roles existed readable
   * through the strict converter (missing key → 'member'). */
  role: OrgMemberRoleSchema.default('member'),
});
export type OrgMemberData = z.infer<typeof OrgMemberDataSchema>;

export interface OrgMemberDataInput {
  joinedAt?: Date;
  role?: OrgMemberRole;
}

export function buildOrgMemberData(input: OrgMemberDataInput = {}): OrgMemberData {
  return {
    joinedAt: input.joinedAt ?? new Date(),
    role: input.role ?? 'member',
  };
}
```

- [ ] **Step 4: Run it, expect PASS**

Run: `pnpm --filter @cultuvilla/shared test -- orgMemberModel`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/organization/OrgMemberDataModel.ts packages/shared/test/models/orgMemberModel.test.ts
git commit -m "feat(shared): add role to org-member model (default member)"
```

---

### Task 2: Org-member service — role-aware add, set-role, admin-id lookup

**Files:**
- Modify: `packages/shared/src/services/orgMemberService.ts`
- Modify: `packages/shared/src/services/_services-map.md`
- Test: `packages/shared/test/services/orgMemberService.test.ts` (create or extend)

**Interfaces:**
- Consumes: `organizationMemberDoc`, `organizationMembersCollection` (existing refs); `OrgMemberRole`, `buildOrgMemberData`.
- Produces:
  - `addOrgMember(orgId: string, userId: string, role?: OrgMemberRole): Promise<void>` (default `'member'`)
  - `setOrgMemberRole(orgId: string, userId: string, role: OrgMemberRole): Promise<void>`
  - `getOrgAdminIds(orgId: string): Promise<string[]>`
  - existing `getOrgMembers/getOrgMemberCount/removeOrgMember/isOrgMember/getOrgMembershipsByUserInMunicipality` unchanged (the membership object returned by the last now includes `role`).

- [ ] **Step 1: Write the failing test** (mock Firestore the way existing service tests do; mirror `packages/shared/test/services/organizationService.test.ts` setup)

```ts
// packages/shared/test/services/orgMemberService.test.ts  (add to existing if present)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addOrgMember, setOrgMemberRole } from '../../src/services/orgMemberService';
import * as fs from 'firebase/firestore';

vi.mock('firebase/firestore', async (orig) => {
  const actual = await orig<typeof import('firebase/firestore')>();
  return { ...actual, setDoc: vi.fn(), updateDoc: vi.fn() };
});
vi.mock('../../src/firebase', () => ({ getDb: () => ({}) }));

beforeEach(() => vi.clearAllMocks());

describe('orgMemberService roles', () => {
  it('addOrgMember writes role member by default', async () => {
    await addOrgMember('org1', 'u1');
    const arg = (fs.setDoc as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(arg).toMatchObject({ role: 'member' });
  });

  it('addOrgMember can seed an admin', async () => {
    await addOrgMember('org1', 'creator', 'admin');
    const arg = (fs.setDoc as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(arg).toMatchObject({ role: 'admin' });
  });

  it('setOrgMemberRole updates only the role', async () => {
    await setOrgMemberRole('org1', 'u1', 'admin');
    const patch = (fs.updateDoc as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(patch).toEqual({ role: 'admin' });
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `pnpm --filter @cultuvilla/shared test -- orgMemberService`
Expected: FAIL (`addOrgMember` arity / `setOrgMemberRole` undefined).

- [ ] **Step 3: Implement** (edit `orgMemberService.ts`)

```ts
import { updateDoc } from 'firebase/firestore'; // add to existing imports
import { buildOrgMemberData, type OrgMemberRole } from '../models/organization/OrgMemberDataModel';

export async function addOrgMember(
  orgId: string,
  userId: string,
  role: OrgMemberRole = 'member',
): Promise<void> {
  await setDoc(organizationMemberDoc(getDb(), orgId, userId), buildOrgMemberData({ role }));
}

export async function setOrgMemberRole(
  orgId: string,
  userId: string,
  role: OrgMemberRole,
): Promise<void> {
  await updateDoc(organizationMemberDoc(getDb(), orgId, userId), { role });
}

export async function getOrgAdminIds(orgId: string): Promise<string[]> {
  const members = await getOrgMembers(orgId);
  return members.filter((m) => m.role === 'admin').map((m) => m.id);
}
```

(Update `UserOrgMembership` and `getOrgMembershipsByUserInMunicipality` so the returned object carries `role` — it already spreads the member doc, so just confirm the type includes `role`.)

- [ ] **Step 4: Run it, expect PASS**

Run: `pnpm --filter @cultuvilla/shared test -- orgMemberService`
Expected: PASS.

- [ ] **Step 5: Update the services map row** for `orgMemberService` to mention `addOrgMember(role)`, `setOrgMemberRole`, `getOrgAdminIds`.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/services/orgMemberService.ts packages/shared/src/services/_services-map.md packages/shared/test/services/orgMemberService.test.ts
git commit -m "feat(shared): role-aware org-member service (add/setRole/adminIds)"
```

---

### Task 3: Rules — `isOrgAdmin`, org-member shape, create/update/delete

**Files:**
- Modify: `firestore.rules`
- Test: `packages/shared/test/e2e/orgMemberRules.test.ts` (create)

**Interfaces:**
- Produces (rules): `isOrgAdmin(orgId)`; `isValidOrgMemberCreate(d)`; updated `/organizations/{orgId}/members/{userId}` block.

- [ ] **Step 1: Write the failing rules test**

```ts
// packages/shared/test/e2e/orgMemberRules.test.ts
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;
const MID = 'mun1';
const ORG = 'org1';

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `organizations/${ORG}`), {
      name: 'Peña', description: null, imageURL: null, type: 'peña',
      status: 'approved', municipalityId: MID, requestedBy: 'creator',
      approvedBy: 'vadmin', createdAt: new Date(), decidedAt: new Date(),
    });
    await setDoc(doc(db, `organizations/${ORG}/members/creator`), { joinedAt: new Date(), role: 'admin' });
    await setDoc(doc(db, `organizations/${ORG}/members/member1`), { joinedAt: new Date(), role: 'member' });
    await setDoc(doc(db, `municipalities/${MID}/members/vadmin`), { userId: 'vadmin', role: 'admin', joinedAt: new Date(), profileAnswers: {}, profileCompletedAt: null, trustedNewsAuthor: false });
  });
}

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'cultuvilla-rules-test', firestore: { rules } });
});
beforeEach(async () => { await env.clearFirestore(); await seed(); });
afterAll(async () => { await env.cleanup(); });

describe('org members — roles', () => {
  it('an org member can add another member with role member', async () => {
    const db = env.authenticatedContext('member1').firestore();
    await assertSucceeds(setDoc(doc(db, `organizations/${ORG}/members/newbie`), { joinedAt: new Date(), role: 'member' }));
  });

  it('a plain member cannot add an admin', async () => {
    const db = env.authenticatedContext('member1').firestore();
    await assertFails(setDoc(doc(db, `organizations/${ORG}/members/newadmin`), { joinedAt: new Date(), role: 'admin' }));
  });

  it('an org admin can promote a member (update role)', async () => {
    const db = env.authenticatedContext('creator').firestore();
    await assertSucceeds(updateDoc(doc(db, `organizations/${ORG}/members/member1`), { role: 'admin' }));
  });

  it('a plain member cannot change roles', async () => {
    const db = env.authenticatedContext('member1').firestore();
    await assertFails(updateDoc(doc(db, `organizations/${ORG}/members/creator`), { role: 'member' }));
  });

  it('an org admin can remove a member', async () => {
    const db = env.authenticatedContext('creator').firestore();
    await assertSucceeds(deleteDoc(doc(db, `organizations/${ORG}/members/member1`)));
  });

  it('a member can remove themselves', async () => {
    const db = env.authenticatedContext('member1').firestore();
    await assertSucceeds(deleteDoc(doc(db, `organizations/${ORG}/members/member1`)));
  });

  it('a doc with an unknown field is rejected on create', async () => {
    const db = env.authenticatedContext('member1').firestore();
    await assertFails(setDoc(doc(db, `organizations/${ORG}/members/newbie`), { joinedAt: new Date(), role: 'member', evil: true }));
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `pnpm test:rules -- orgMemberRules`
Expected: FAIL (promotion blocked — current `update: if false`; admin-add not constrained; no shape check).

- [ ] **Step 3: Implement the rules.** Add the helper next to `isOrgMember`:

```
function isOrgAdmin(orgId) {
  return isAuthenticated() &&
    exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)) &&
    get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.role == 'admin';
}
```

Add the shape predicate next to `isValidOrganizationCreate`:

```
function isValidOrgMemberCreate(d) {
  return d.keys().hasOnly(['joinedAt', 'role'])
      && d.keys().hasAll(['joinedAt', 'role'])
      && isTimestamp(d.joinedAt)
      && d.role in ['admin', 'member'];
}
```

Replace the `match /members/{userId}` block:

```
match /members/{userId} {
  allow read: if true;
  // org admin / village admin / app admin may add anyone (incl. seeding an admin);
  // a plain member may only add others as 'member'.
  allow create: if isValidOrgMemberCreate(request.resource.data)
    && (
         isOrgAdmin(orgId)
         || isVillageAdmin(orgMunicipalityId(orgId))
         || isAppAdmin()
         || (isOrgMember(orgId) && request.resource.data.role == 'member')
       );
  // only the role may change, and only an org admin / backstop may change it.
  allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['role'])
    && request.resource.data.role in ['admin', 'member']
    && (isOrgAdmin(orgId) || isVillageAdmin(orgMunicipalityId(orgId)) || isAppAdmin());
  allow delete: if isOwner(userId)
    || isOrgAdmin(orgId)
    || isVillageAdmin(orgMunicipalityId(orgId))
    || isAppAdmin();
}
```

- [ ] **Step 4: Run it, expect PASS**

Run: `pnpm test:rules -- orgMemberRules`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules packages/shared/test/e2e/orgMemberRules.test.ts
git commit -m "feat(rules): org-admin role — shape + role-gated create/update/delete"
```

---

### Task 4: Seed org creator as admin on approval

**Files:**
- Modify: `packages/shared/src/services/organizationService.ts`
- Test: `packages/shared/test/services/organizationService.test.ts` (extend)

**Interfaces:**
- Consumes: `addOrgMember(orgId, userId, 'admin')` from Task 2.
- Produces: `approveOrganization(orgId, approvedBy, creatorUserId)` now also seeds the creator as an admin member. (Add the creator param rather than re-reading the doc, so the caller — which already has the org in hand — passes `requestedBy`.)

- [ ] **Step 1: Write the failing test**

```ts
// extend organizationService.test.ts
import { approveOrganization } from '../../src/services/organizationService';
import * as orgMember from '../../src/services/orgMemberService';

it('approveOrganization seeds requestedBy as an org admin', async () => {
  const spy = vi.spyOn(orgMember, 'addOrgMember').mockResolvedValue();
  await approveOrganization('org1', 'vadmin', 'creator');
  expect(spy).toHaveBeenCalledWith('org1', 'creator', 'admin');
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `pnpm --filter @cultuvilla/shared test -- organizationService`
Expected: FAIL (arity / no seeding).

- [ ] **Step 3: Implement** — update `approveOrganization`:

```ts
import { addOrgMember } from './orgMemberService';

export async function approveOrganization(
  orgId: string,
  approvedBy: string,
  creatorUserId: string,
): Promise<void> {
  await updateDoc(doc(getDb(), 'organizations', orgId), {
    status: 'approved',
    approvedBy,
    decidedAt: serverTimestamp(),
  });
  // Seed the requester as the founding admin. Non-atomic with the status flip;
  // acceptable — re-running approve is idempotent (setDoc overwrites).
  await addOrgMember(orgId, creatorUserId, 'admin');
}
```

- [ ] **Step 4: Run it, expect PASS**

Run: `pnpm --filter @cultuvilla/shared test -- organizationService`
Expected: PASS. Update existing `approveOrganization` call sites (search `approveOrganization(` across `apps/mobile`) to pass the org's `requestedBy`.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/services/organizationService.ts packages/shared/test/services/organizationService.test.ts
git commit -m "feat(shared): seed org creator as admin on approval"
```

---

### Task 5: Backfill existing org-member roles

**Files:** Create `scripts/backfill-org-member-roles.mjs`.

Uses the `firebase-admin-dev` skill (ADC against `villa-events`). Idempotent: sets `requestedBy` member → `admin`, every other existing member → `member` only if `role` is missing.

- [ ] **Step 1: Write the script**

```js
// scripts/backfill-org-member-roles.mjs
// Usage: node scripts/backfill-org-member-roles.mjs            (dry run)
//        node scripts/backfill-org-member-roles.mjs --apply    (writes)
import admin from 'firebase-admin';

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'villa-events' });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const orgs = await db.collection('organizations').get();
let toAdmin = 0, toMember = 0;
for (const org of orgs.docs) {
  const requestedBy = org.get('requestedBy');
  const members = await org.ref.collection('members').get();
  for (const m of members.docs) {
    if (m.get('role')) continue; // already migrated
    const role = m.id === requestedBy ? 'admin' : 'member';
    if (role === 'admin') toAdmin++; else toMember++;
    if (APPLY) await m.ref.set({ role }, { merge: true });
  }
}
console.log(`${APPLY ? 'WROTE' : 'DRY-RUN'}: ${toAdmin} admins, ${toMember} members`);
process.exit(0);
```

- [ ] **Step 2: Dry-run against dev**

Run: `node scripts/backfill-org-member-roles.mjs`
Expected: prints `DRY-RUN: N admins, M members`, no writes.

- [ ] **Step 3: Apply against dev**

Run: `node scripts/backfill-org-member-roles.mjs --apply`
Expected: prints `WROTE: …`. (Beta/prod runs are deferred to the rollout table.)

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-org-member-roles.mjs
git commit -m "chore(scripts): backfill org-member roles (creator->admin)"
```

---

### Task 6: Join-request model + converter + refs

**Files:**
- Create: `packages/shared/src/models/organizationJoinRequest/OrganizationJoinRequestDataModel.ts`, `…/index.ts`
- Modify: `packages/shared/src/models/index.ts`
- Create: `packages/shared/src/firebase/converters/organizationJoinRequestConverter.ts`
- Modify: `packages/shared/src/firebase/refs/client.ts`, `admin.ts`
- Test: `packages/shared/test/models/organizationJoinRequestModel.test.ts`

**Interfaces:**
- Produces: `OrganizationJoinRequestData = { userId, orgId, municipalityId, status: 'pending'|'approved'|'rejected', requestedAt: Date, reviewedAt: Date|null, reviewedBy: string|null }`; `buildOrganizationJoinRequestData(input)`; `organizationJoinRequestsCollection(db)` / `organizationJoinRequestDoc(db, id)` in both refs files.

- [ ] **Step 1: Write the failing model test**

```ts
import { describe, it, expect } from 'vitest';
import {
  OrganizationJoinRequestDataSchema, buildOrganizationJoinRequestData,
} from '../../src/models/organizationJoinRequest/OrganizationJoinRequestDataModel';

describe('OrganizationJoinRequestDataModel', () => {
  it('builds a pending request with null review fields', () => {
    const r = buildOrganizationJoinRequestData({ userId: 'u', orgId: 'o', municipalityId: 'm' });
    expect(r).toMatchObject({ status: 'pending', reviewedAt: null, reviewedBy: null });
    expect(r.requestedAt).toBeInstanceOf(Date);
  });
  it('rejects an unknown status', () => {
    expect(() => OrganizationJoinRequestDataSchema.parse({
      userId: 'u', orgId: 'o', municipalityId: 'm', status: 'maybe',
      requestedAt: new Date(), reviewedAt: null, reviewedBy: null,
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.** Run: `pnpm --filter @cultuvilla/shared test -- organizationJoinRequestModel`

- [ ] **Step 3: Implement the model**

```ts
// packages/shared/src/models/organizationJoinRequest/OrganizationJoinRequestDataModel.ts
import { z } from 'zod';

export const OrganizationJoinRequestStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type OrganizationJoinRequestStatus = z.infer<typeof OrganizationJoinRequestStatusSchema>;

export const OrganizationJoinRequestDataSchema = z.object({
  userId: z.string(),
  orgId: z.string(),
  municipalityId: z.string(),
  status: OrganizationJoinRequestStatusSchema,
  requestedAt: z.date(),
  reviewedAt: z.date().nullable(),
  reviewedBy: z.string().nullable(),
});
export type OrganizationJoinRequestData = z.infer<typeof OrganizationJoinRequestDataSchema>;

export interface OrganizationJoinRequestDataInput {
  userId: string;
  orgId: string;
  municipalityId: string;
}

export function buildOrganizationJoinRequestData(
  input: OrganizationJoinRequestDataInput,
): OrganizationJoinRequestData {
  return {
    userId: input.userId,
    orgId: input.orgId,
    municipalityId: input.municipalityId,
    status: 'pending',
    requestedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
  };
}
```

`…/index.ts`: `export * from './OrganizationJoinRequestDataModel';`
`models/index.ts`: add `export * from './organizationJoinRequest';`

- [ ] **Step 4: Implement the converter**

```ts
// packages/shared/src/firebase/converters/organizationJoinRequestConverter.ts
import { OrganizationJoinRequestDataSchema } from '../../models/organizationJoinRequest/OrganizationJoinRequestDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const organizationJoinRequestConverterClient = makeConverter(OrganizationJoinRequestDataSchema, clientSdkCtors);
export const organizationJoinRequestConverterAdmin = makeConverter(OrganizationJoinRequestDataSchema, adminSdkCtors);
```

- [ ] **Step 5: Add ref factories** (client.ts and admin.ts), importing the matching converter:

```ts
// client.ts
export const organizationJoinRequestsCollection = (db: Firestore) =>
  collection(db, 'organizationJoinRequests').withConverter(organizationJoinRequestConverterClient);
export const organizationJoinRequestDoc = (db: Firestore, id: string) =>
  doc(db, 'organizationJoinRequests', id).withConverter(organizationJoinRequestConverterClient);

// admin.ts
export const organizationJoinRequestsCollection = (db: Firestore) =>
  db.collection('organizationJoinRequests').withConverter(organizationJoinRequestConverterAdmin);
export const organizationJoinRequestDoc = (db: Firestore, id: string) =>
  db.collection('organizationJoinRequests').doc(id).withConverter(organizationJoinRequestConverterAdmin);
```

- [ ] **Step 6: Run model test (PASS) + grep gate**

Run: `pnpm --filter @cultuvilla/shared test -- organizationJoinRequestModel && pnpm check:no-raw-firestore-refs`
Expected: PASS, gate clean.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/models/organizationJoinRequest packages/shared/src/models/index.ts packages/shared/src/firebase/converters/organizationJoinRequestConverter.ts packages/shared/src/firebase/refs/client.ts packages/shared/src/firebase/refs/admin.ts packages/shared/test/models/organizationJoinRequestModel.test.ts
git commit -m "feat(shared): organizationJoinRequest model + converter + refs"
```

---

### Task 7: Join-request client service

**Files:**
- Create: `packages/shared/src/services/organizationJoinRequestService.ts`
- Modify: `packages/shared/src/services/index.ts`, `_services-map.md`
- Test: `packages/shared/test/services/organizationJoinRequestService.test.ts`

**Interfaces:**
- Consumes: `organizationJoinRequestsCollection/Doc` (client refs); `getFirebaseFunctions`, `httpsCallable`.
- Produces:
  - `requestJoinOrganization(orgId: string): Promise<{ requestId: string }>` (callable wrapper)
  - `respondToJoinRequest(requestId: string, decision: 'approved'|'rejected'): Promise<void>` (callable wrapper)
  - `getPendingJoinRequestsForOrgs(orgIds: string[]): Promise<(OrganizationJoinRequestData & { id: string })[]>` (chunks `in` queries by 30)
  - `getAllPendingJoinRequests(): Promise<(… & { id: string })[]>` (super-admin firehose)
  - `getMyJoinRequests(userId: string): Promise<(… & { id: string })[]>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const callable = vi.fn().mockResolvedValue({ data: { ok: true, requestId: 'r1' } });
vi.mock('firebase/functions', () => ({ httpsCallable: () => callable }));
vi.mock('../../src/firebase', () => ({ getDb: () => ({}), getFirebaseFunctions: () => ({}) }));

import { requestJoinOrganization } from '../../src/services/organizationJoinRequestService';

beforeEach(() => callable.mockClear());

describe('organizationJoinRequestService', () => {
  it('requestJoinOrganization invokes the callable with orgId and returns requestId', async () => {
    const res = await requestJoinOrganization('org1');
    expect(callable).toHaveBeenCalledWith({ orgId: 'org1' });
    expect(res.requestId).toBe('r1');
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.** Run: `pnpm --filter @cultuvilla/shared test -- organizationJoinRequestService`

- [ ] **Step 3: Implement**

```ts
// packages/shared/src/services/organizationJoinRequestService.ts
import { getDocs, query, where, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDb, getFirebaseFunctions } from '../firebase';
import { organizationJoinRequestsCollection } from '../firebase/refs/client';
import type { OrganizationJoinRequestData } from '../models/organizationJoinRequest/OrganizationJoinRequestDataModel';

type WithId = OrganizationJoinRequestData & { id: string };

export async function requestJoinOrganization(orgId: string): Promise<{ requestId: string }> {
  const fn = httpsCallable<{ orgId: string }, { ok: true; requestId: string }>(
    getFirebaseFunctions(), 'requestJoinOrganization',
  );
  const res = await fn({ orgId });
  return { requestId: res.data.requestId };
}

export async function respondToJoinRequest(
  requestId: string, decision: 'approved' | 'rejected',
): Promise<void> {
  const fn = httpsCallable<{ requestId: string; decision: 'approved' | 'rejected' }, { ok: true }>(
    getFirebaseFunctions(), 'respondToJoinRequest',
  );
  await fn({ requestId, decision });
}

export async function getAllPendingJoinRequests(): Promise<WithId[]> {
  const q = query(organizationJoinRequestsCollection(getDb()),
    where('status', '==', 'pending'), orderBy('requestedAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getPendingJoinRequestsForOrgs(orgIds: string[]): Promise<WithId[]> {
  const out: WithId[] = [];
  for (let i = 0; i < orgIds.length; i += 30) {
    const chunk = orgIds.slice(i, i + 30);
    if (chunk.length === 0) continue;
    const q = query(organizationJoinRequestsCollection(getDb()),
      where('orgId', 'in', chunk), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    out.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  return out;
}

export async function getMyJoinRequests(userId: string): Promise<WithId[]> {
  const q = query(organizationJoinRequestsCollection(getDb()),
    where('userId', '==', userId), orderBy('requestedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
```

`services/index.ts`: `export * from './organizationJoinRequestService';`
`_services-map.md`: add a row for `organizationJoinRequestService`.

- [ ] **Step 4: Run it, expect PASS.** Run: `pnpm --filter @cultuvilla/shared test -- organizationJoinRequestService`

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/services/organizationJoinRequestService.ts packages/shared/src/services/index.ts packages/shared/src/services/_services-map.md packages/shared/test/services/organizationJoinRequestService.test.ts
git commit -m "feat(shared): organizationJoinRequest client service"
```

---

### Task 8: Join-request rules + shape + indexes

**Files:**
- Modify: `firestore.rules`, `firestore.indexes.json`
- Test: `packages/shared/test/e2e/organizationJoinRequestRules.test.ts`

**Interfaces:**
- Produces (rules): `isValidJoinRequestCreate(d)`; `/organizationJoinRequests/{id}` match block. Writes that change status are `false` (callable-only); create allowed for the requester; reads gated to requester + org admin + app admin.

- [ ] **Step 1: Write the failing rules test**

```ts
// packages/shared/test/e2e/organizationJoinRequestRules.test.ts
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;
const ORG = 'org1', MID = 'mun1', REQUESTER = 'alice', ADMIN = 'creator', OUTSIDER = 'bob', APP = 'sadmin';

async function seedOrg() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `organizations/${ORG}`), { municipalityId: MID, status: 'approved', requestedBy: ADMIN, name: 'P', description: null, imageURL: null, type: 'peña', approvedBy: 'x', createdAt: new Date(), decidedAt: new Date() });
    await setDoc(doc(db, `organizations/${ORG}/members/${ADMIN}`), { joinedAt: new Date(), role: 'admin' });
    await setDoc(doc(db, `admins/${APP}`), { createdAt: new Date() });
  });
}
function reqDoc() {
  return { userId: REQUESTER, orgId: ORG, municipalityId: MID, status: 'pending', requestedAt: new Date(), reviewedAt: null, reviewedBy: null };
}

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'cultuvilla-rules-test', firestore: { rules } });
});
beforeEach(async () => { await env.clearFirestore(); await seedOrg(); });
afterAll(async () => { await env.cleanup(); });

describe('/organizationJoinRequests', () => {
  it('a user can create their own pending request', async () => {
    const db = env.authenticatedContext(REQUESTER).firestore();
    await assertSucceeds(setDoc(doc(db, 'organizationJoinRequests/r1'), reqDoc()));
  });
  it('a user cannot create a request for someone else', async () => {
    const db = env.authenticatedContext(OUTSIDER).firestore();
    await assertFails(setDoc(doc(db, 'organizationJoinRequests/r1'), reqDoc()));
  });
  it('a non-pending create is rejected', async () => {
    const db = env.authenticatedContext(REQUESTER).firestore();
    await assertFails(setDoc(doc(db, 'organizationJoinRequests/r1'), { ...reqDoc(), status: 'approved' }));
  });
  it('an unknown field is rejected', async () => {
    const db = env.authenticatedContext(REQUESTER).firestore();
    await assertFails(setDoc(doc(db, 'organizationJoinRequests/r1'), { ...reqDoc(), evil: 1 }));
  });
  it('the org admin can read a request', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'organizationJoinRequests/r1'), reqDoc()));
    const db = env.authenticatedContext(ADMIN).firestore();
    await assertSucceeds(getDoc(doc(db, 'organizationJoinRequests/r1')));
  });
  it('an outsider cannot read a request', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'organizationJoinRequests/r1'), reqDoc()));
    const db = env.authenticatedContext(OUTSIDER).firestore();
    await assertFails(getDoc(doc(db, 'organizationJoinRequests/r1')));
  });
  it('no client may flip status (callable-only)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'organizationJoinRequests/r1'), reqDoc()));
    const db = env.authenticatedContext(ADMIN).firestore();
    await assertFails(updateDoc(doc(db, 'organizationJoinRequests/r1'), { status: 'approved' }));
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.** Run: `pnpm test:rules -- organizationJoinRequestRules`

- [ ] **Step 3: Implement the rules.** Shape predicate (near the others):

```
function isValidJoinRequestCreate(d) {
  return d.keys().hasOnly(['userId', 'orgId', 'municipalityId', 'status', 'requestedAt', 'reviewedAt', 'reviewedBy'])
      && d.keys().hasAll(['userId', 'orgId', 'municipalityId', 'status', 'requestedAt', 'reviewedAt', 'reviewedBy'])
      && isString(d.userId) && isString(d.orgId) && isString(d.municipalityId)
      && d.status == 'pending'
      && isTimestamp(d.requestedAt)
      && d.reviewedAt == null && d.reviewedBy == null;
}
```

Match block (top-level, near `/organizerRequests`):

```
match /organizationJoinRequests/{requestId} {
  allow read: if isOwner(resource.data.userId)
    || isOrgAdmin(resource.data.orgId)
    || isAppAdmin();
  allow create: if isOwner(request.resource.data.userId)
    && isValidJoinRequestCreate(request.resource.data);
  // status transitions only via respondToJoinRequest (admin SDK).
  allow update, delete: if false;
}
```

- [ ] **Step 4: Add composite indexes** to `firestore.indexes.json`:

```json
{ "collectionGroup": "organizationJoinRequests", "queryScope": "COLLECTION",
  "fields": [ { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "requestedAt", "order": "ASCENDING" } ] },
{ "collectionGroup": "organizationJoinRequests", "queryScope": "COLLECTION",
  "fields": [ { "fieldPath": "orgId", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" } ] },
{ "collectionGroup": "organizationJoinRequests", "queryScope": "COLLECTION",
  "fields": [ { "fieldPath": "userId", "order": "ASCENDING" }, { "fieldPath": "requestedAt", "order": "DESCENDING" } ] }
```

- [ ] **Step 5: Run it, expect PASS.** Run: `pnpm test:rules -- organizationJoinRequestRules`

- [ ] **Step 6: Commit**

```bash
git add firestore.rules firestore.indexes.json packages/shared/test/e2e/organizationJoinRequestRules.test.ts
git commit -m "feat(rules): organizationJoinRequests block + shape + indexes"
```

---

### Task 9: `requestJoinOrganization` callable

**Files:**
- Create: `functions/src/organizations/requestJoinOrganization.ts`
- Modify: `functions/src/index.ts`, `functions/src/helpers/notifyRequests.ts`

**Interfaces:**
- Consumes (admin refs): `organizationDoc`, `organizationMemberDoc`, `organizationJoinRequestsCollection`. Notifications: `notifyJoinRequestCreated`.
- Produces: callable `requestJoinOrganization({ orgId }) -> { ok, requestId }`.

- [ ] **Step 1: Implement the callable** (mirror `requestOrganizeVillage`: auth → validate → duplicate/membership check → set doc → notify)

```ts
// functions/src/organizations/requestJoinOrganization.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import {
  organizationDoc, organizationMemberDoc, organizationJoinRequestsCollection,
} from '@cultuvilla/shared/firebase/refs/admin';
import { buildOrganizationJoinRequestData } from '@cultuvilla/shared/models';
import { notifyJoinRequestCreated } from '../helpers/notifyRequests';

const db = admin.firestore();
const HANDLER = 'requestJoinOrganization';

interface Data { orgId?: string }
interface Result { ok: true; requestId: string }

export const requestJoinOrganization = onCall<Data, Promise<Result>>(
  { region: 'us-central1', cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
    const orgId = request.data.orgId;
    if (!orgId) throw new HttpsError('invalid-argument', 'orgId is required.');

    const orgSnap = await organizationDoc(db, orgId).get();
    if (!orgSnap.exists) throw new HttpsError('not-found', 'Organization not found.');
    const org = orgSnap.data()!;
    if (org.status !== 'approved') throw new HttpsError('failed-precondition', 'Organization not approved.');

    const memberSnap = await organizationMemberDoc(db, orgId, uid).get();
    if (memberSnap.exists) throw new HttpsError('already-exists', 'Already a member.');

    const dup = await organizationJoinRequestsCollection(db)
      .where('userId', '==', uid).where('orgId', '==', orgId).where('status', '==', 'pending').limit(1).get();
    if (!dup.empty) throw new HttpsError('already-exists', 'A pending request already exists.');

    const ref = organizationJoinRequestsCollection(db).doc();
    await ref.set(buildOrganizationJoinRequestData({ userId: uid, orgId, municipalityId: org.municipalityId }));

    logger.info('join request created', { handler: HANDLER, orgId, requesterUid: uid, requestId: ref.id });
    await notifyJoinRequestCreated({ orgId, orgName: org.name, municipalityId: org.municipalityId, requesterUid: uid });
    return { ok: true, requestId: ref.id };
  },
);
```

- [ ] **Step 2: Add the notification helper** to `notifyRequests.ts` (fan out to org admins)

```ts
import { organizationMembersCollection } from '@cultuvilla/shared/firebase/refs/admin';

interface NotifyJoinRequestCreatedInput { orgId: string; orgName: string; municipalityId: string; requesterUid: string; }

export async function notifyJoinRequestCreated(input: NotifyJoinRequestCreatedInput): Promise<void> {
  const members = await organizationMembersCollection(db, input.orgId).where('role', '==', 'admin').get();
  if (members.empty) return;
  const batch = db.batch();
  for (const a of members.docs) {
    const ref = userNotificationsCollection(db, a.id).doc();
    batch.set(ref, buildNotificationData({
      type: 'join_request_created',
      title: 'Nueva solicitud para unirse',
      body: `${input.requesterUid} quiere unirse a ${input.orgName}`,
      municipalityId: input.municipalityId,
      requesterUid: input.requesterUid,
    }));
  }
  await batch.commit();
}
```

- [ ] **Step 3: Register** in `functions/src/index.ts` under the Organizations section:

```ts
export { requestJoinOrganization } from './organizations/requestJoinOrganization';
```

- [ ] **Step 4: Typecheck + build**

Run: `pnpm functions:typecheck && pnpm functions:build`
Expected: clean (no `console.*` — the no-console test stays green).

- [ ] **Step 5: Commit**

```bash
git add functions/src/organizations/requestJoinOrganization.ts functions/src/index.ts functions/src/helpers/notifyRequests.ts
git commit -m "feat(functions): requestJoinOrganization callable + notify org admins"
```

---

### Task 10: `respondToJoinRequest` callable (transaction)

**Files:**
- Create: `functions/src/organizations/respondToJoinRequest.ts`
- Modify: `functions/src/index.ts`, `functions/src/helpers/notifyRequests.ts`
- Test: `functions/test/respondToJoinRequest.test.ts` (vitest emulator harness — mirror existing function tests)

**Interfaces:**
- Consumes: `organizationJoinRequestDoc`, `organizationMemberDoc` (admin refs); `isOrgAdmin`-equivalent check (read the caller's member doc role); `notifyJoinRequestResolved`.
- Produces: callable `respondToJoinRequest({ requestId, decision }) -> { ok }`.

- [ ] **Step 1: Write the failing function test** (mirror an existing `functions/test/*.test.ts` emulator setup)

```ts
// functions/test/respondToJoinRequest.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
// ...reuse the repo's emulator test bootstrap (admin app + wrapped callable)...

describe('respondToJoinRequest', () => {
  it('approving writes the member doc with role member and flips status', async () => {
    // seed org + admin caller + pending request, call approve, assert member exists & status approved
  });
  it('a non-org-admin caller is rejected with permission-denied', async () => {
    // seed pending request, call as a non-admin, expect HttpsError permission-denied
  });
});
```

(Fill the seed/call bodies to match the harness used by `functions/test/respondToOrganizerRequest.test.ts` if present; otherwise follow `functions/test`'s existing pattern.)

- [ ] **Step 2: Run it, expect FAIL.** Run: `pnpm functions:test -- respondToJoinRequest`

- [ ] **Step 3: Implement** (transaction: read request + caller membership, gate, flip status, write member on approve)

```ts
// functions/src/organizations/respondToJoinRequest.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import {
  organizationJoinRequestDoc, organizationMemberDoc, adminDoc,
} from '@cultuvilla/shared/firebase/refs/admin';
import { buildOrgMemberData } from '@cultuvilla/shared/models';
import { notifyJoinRequestResolved } from '../helpers/notifyRequests';

const db = admin.firestore();
const HANDLER = 'respondToJoinRequest';

interface Data { requestId?: string; decision?: 'approved' | 'rejected' }
interface Result { ok: true }

export const respondToJoinRequest = onCall<Data, Promise<Result>>(
  { region: 'us-central1', cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
    const { requestId, decision } = request.data;
    if (!requestId || (decision !== 'approved' && decision !== 'rejected'))
      throw new HttpsError('invalid-argument', 'requestId and a valid decision are required.');

    const reqRef = organizationJoinRequestDoc(db, requestId);
    let resolved: { orgId: string; orgName: string; municipalityId: string; requesterUid: string } | null = null;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(reqRef);
      if (!snap.exists) throw new HttpsError('not-found', 'Request not found.');
      const req = snap.data()!;
      if (req.status !== 'pending') throw new HttpsError('failed-precondition', 'Already resolved.');

      // gate: caller must be org admin OR app admin
      const callerMember = await tx.get(organizationMemberDoc(db, req.orgId, uid));
      const appAdmin = await tx.get(adminDoc(db, uid));
      const isOrgAdmin = callerMember.exists && callerMember.data()!.role === 'admin';
      if (!isOrgAdmin && !appAdmin.exists)
        throw new HttpsError('permission-denied', 'Only an org admin may respond.');

      tx.update(reqRef, { status: decision, reviewedAt: new Date(), reviewedBy: uid });
      if (decision === 'approved') {
        tx.set(organizationMemberDoc(db, req.orgId, req.userId), buildOrgMemberData({ role: 'member' }));
      }
      const orgSnap = await tx.get(
        db.collection('organizations').doc(req.orgId), // read for orgName — or thread via refs
      );
      resolved = { orgId: req.orgId, orgName: orgSnap.get('name') ?? '', municipalityId: req.municipalityId, requesterUid: req.userId };
    });

    logger.info('join request resolved', { handler: HANDLER, requestId, decision, reviewedBy: uid });
    if (resolved) await notifyJoinRequestResolved({ ...resolved, decision });
    return { ok: true };
  },
);
```

(If reading the org inside the transaction for `orgName` is awkward, read it before the transaction and pass through — keep all `tx.get` calls before any `tx.write`.)

- [ ] **Step 4: Add `notifyJoinRequestResolved`** to `notifyRequests.ts`

```ts
interface NotifyJoinRequestResolvedInput { orgId: string; orgName: string; municipalityId: string; requesterUid: string; decision: 'approved' | 'rejected'; }

export async function notifyJoinRequestResolved(input: NotifyJoinRequestResolvedInput): Promise<void> {
  const approved = input.decision === 'approved';
  const ref = userNotificationsCollection(db, input.requesterUid).doc();
  await ref.set(buildNotificationData({
    type: approved ? 'join_request_approved' : 'join_request_rejected',
    title: approved ? 'Solicitud aceptada' : 'Solicitud rechazada',
    body: approved ? `Te has unido a ${input.orgName}.` : `Tu solicitud para unirte a ${input.orgName} fue rechazada.`,
    municipalityId: input.municipalityId,
  }));
}
```

- [ ] **Step 5: Register + test**

Add `export { respondToJoinRequest } from './organizations/respondToJoinRequest';` to `functions/src/index.ts`.
Run: `pnpm functions:test -- respondToJoinRequest && pnpm functions:typecheck`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add functions/src/organizations/respondToJoinRequest.ts functions/src/index.ts functions/src/helpers/notifyRequests.ts functions/test/respondToJoinRequest.test.ts
git commit -m "feat(functions): respondToJoinRequest callable (transactional approve/reject)"
```

---

### Task 11: i18n strings for Solicitudes

**Files:** Modify `packages/i18n/` (follow the `i18n-add-string` skill — add to the shared catalog under a `solicitudes` namespace).

- [ ] **Step 1: Add keys** (Spanish source): `solicitudes.title` ("Solicitudes"), `solicitudes.empty` ("No hay solicitudes pendientes"), `solicitudes.tab.organizer` ("Organizador"), `solicitudes.tab.org` ("Organizaciones"), `solicitudes.tab.join` ("Unirse"), `solicitudes.approve` ("Aprobar"), `solicitudes.reject` ("Rechazar"), `solicitudes.organizerRow` ("{user} quiere organizar {municipality}"), `solicitudes.motivation` ("Motivo"), `solicitudes.joinRow` ("{user} quiere unirse a {org}"), `solicitudes.orgRow` ("{org} ({type})"), `menu.solicitudes` ("Solicitudes").

- [ ] **Step 2: Typecheck i18n.** Run: `pnpm i18n:typecheck` → clean.

- [ ] **Step 3: Commit**

```bash
git add packages/i18n
git commit -m "i18n: solicitudes inbox strings"
```

---

### Task 12: Approver-status hook

**Files:**
- Create: `apps/mobile/lib/auth/useApproverStatus.ts`

**Interfaces:**
- Consumes: `useAuth`, `isAppAdmin` service, `getOrganizationsByMunicipality`, `getOrgMembershipsByUserInMunicipality`, the user's active municipality (from the user doc / existing context).
- Produces: `useApproverStatus(): { loading: boolean; isSuperAdmin: boolean; isVillageAdmin: boolean; adminOrgIds: string[]; canApprove: boolean }` where `canApprove = isSuperAdmin || isVillageAdmin || adminOrgIds.length > 0`.

- [ ] **Step 1: Implement** (mirror `useIsAppAdmin` structure; resolve village-admin from the active municipality member doc's role, and `adminOrgIds` from org memberships in the active municipality filtered to `role === 'admin'`)

```ts
// apps/mobile/lib/auth/useApproverStatus.ts
import { useEffect, useState } from 'react';
import { isAppAdmin as isAppAdminService } from '@cultuvilla/shared/services/adminService';
import { getVillageMember } from '@cultuvilla/shared/services/villageMemberService';
import { getOrgMembershipsByUserInMunicipality } from '@cultuvilla/shared/services/orgMemberService';
import { useAuth } from './useAuth';
import { useActiveMunicipality } from './useActiveMunicipality'; // existing source of active village id

export interface ApproverStatus {
  loading: boolean; isSuperAdmin: boolean; isVillageAdmin: boolean; adminOrgIds: string[]; canApprove: boolean;
}

export function useApproverStatus(): ApproverStatus {
  const { user } = useAuth();
  const municipalityId = useActiveMunicipality();
  const [s, setS] = useState<ApproverStatus>({ loading: true, isSuperAdmin: false, isVillageAdmin: false, adminOrgIds: [], canApprove: false });

  useEffect(() => {
    let cancelled = false;
    if (!user) { setS({ loading: false, isSuperAdmin: false, isVillageAdmin: false, adminOrgIds: [], canApprove: false }); return; }
    (async () => {
      const [superAdmin, vMember, orgMemberships] = await Promise.all([
        isAppAdminService(user.uid),
        municipalityId ? getVillageMember(municipalityId, user.uid) : Promise.resolve(null),
        municipalityId ? getOrgMembershipsByUserInMunicipality(user.uid, municipalityId) : Promise.resolve([]),
      ]);
      if (cancelled) return;
      const isVillageAdmin = vMember?.role === 'admin';
      const adminOrgIds = orgMemberships.filter((m) => m.role === 'admin').map((m) => m.orgId);
      const next = { loading: false, isSuperAdmin: superAdmin, isVillageAdmin, adminOrgIds,
        canApprove: superAdmin || isVillageAdmin || adminOrgIds.length > 0 };
      setS(next);
    })();
    return () => { cancelled = true; };
  }, [user, municipalityId]);

  return s;
}
```

(If `getVillageMember` or `useActiveMunicipality` differ in name, use the existing equivalents — confirm during implementation; the membership object's `orgId` field comes from `UserOrgMembership`.)

- [ ] **Step 2: Typecheck mobile.** Run: `pnpm --filter cultuvilla-mobile exec tsc --noEmit` → clean.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/auth/useApproverStatus.ts
git commit -m "feat(mobile): useApproverStatus hook (super/village/org admin)"
```

---

### Task 13: Solicitudes inbox screen

**Files:**
- Create: `apps/mobile/app/solicitudes/index.tsx`

**Interfaces:**
- Consumes: `useApproverStatus`; `getPendingOrganizerRequests`, `respondToOrganizerRequest`; `getOrganizationsByMunicipality(mid,'pending')`, `approveOrganization`, `rejectOrganization`; `getAllPendingJoinRequests`/`getPendingJoinRequestsForOrgs`, `respondToJoinRequest`; municipality name lookup for organizer rows.

- [ ] **Step 1: Implement the screen.** Sections by role:
  - If `isSuperAdmin`: load all three (`getPendingOrganizerRequests()`, all pending orgs across villages, `getAllPendingJoinRequests()`).
  - Else: if `isVillageAdmin`, load `getOrganizationsByMunicipality(activeMid,'pending')`; if `adminOrgIds.length`, load `getPendingJoinRequestsForOrgs(adminOrgIds)`.
  - Organizer rows render `solicitudes.organizerRow` (resolve `municipalityId` → name) and, when `motivation` is present, a `solicitudes.motivation` line.
  - Each row: Aprobar / Rechazar buttons calling the right service; on success, remove the row from local state. Use RN `Modal`/inline confirm — **not** `Alert.alert` (no-op on web). Put styles on `style` for any `Animated.*` per `mobile-web-compat`.
  - Guard the screen: if `!loading && !canApprove`, `router.replace('/')`.

```tsx
// apps/mobile/app/solicitudes/index.tsx  (abridged — full impl follows the patterns above)
import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useT } from '../../lib/i18n/useT';
import { useApproverStatus } from '../../lib/auth/useApproverStatus';
import { getPendingOrganizerRequests, respondToOrganizerRequest } from '@cultuvilla/shared/services/organizerRequestService';
import { getOrganizationsByMunicipality, approveOrganization, rejectOrganization } from '@cultuvilla/shared/services/organizationService';
import { getAllPendingJoinRequests, getPendingJoinRequestsForOrgs, respondToJoinRequest } from '@cultuvilla/shared/services/organizationJoinRequestService';

export default function SolicitudesScreen() {
  const t = useT();
  const { loading, isSuperAdmin, isVillageAdmin, adminOrgIds, canApprove } = useApproverStatus();
  // ...local state: organizerReqs, orgReqs, joinReqs, busy...
  // ...load effect keyed on (loading, isSuperAdmin, isVillageAdmin, adminOrgIds)...
  useEffect(() => { if (!loading && !canApprove) router.replace('/'); }, [loading, canApprove]);
  if (loading) return <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>;
  // ...render three Section... each row with Aprobar/Rechazar...
  return <View className="flex-1">{/* sections */}</View>;
}
```

- [ ] **Step 2: Typecheck + web-compat check.** Run: `pnpm --filter cultuvilla-mobile exec tsc --noEmit && pnpm app:check-web-compat` → clean.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/solicitudes/index.tsx
git commit -m "feat(mobile): Solicitudes inbox screen (role-scoped)"
```

---

### Task 14: Gate the Solicitudes menu entry

**Files:** Modify `apps/mobile/components/feature/UserMenuModal.tsx`.

- [ ] **Step 1: Add the menu item** using `useApproverStatus().canApprove` (mirror the existing `isAppAdmin` spread):

```tsx
const { canApprove } = useApproverStatus();
// ...in the sections array...
...(canApprove
  ? [{
      title: t('solicitudes.title'),
      items: [{
        icon: 'mail-unread-outline' as const,
        label: t('menu.solicitudes'),
        onPress: () => close(() => router.push('/solicitudes')),
      }],
    }]
  : []),
```

- [ ] **Step 2: Typecheck + web-compat.** Run: `pnpm --filter cultuvilla-mobile exec tsc --noEmit && pnpm app:check-web-compat` → clean.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/feature/UserMenuModal.tsx
git commit -m "feat(mobile): show Solicitudes in menu for approvers only"
```

---

### Task 15: Full check + deploy notes

- [ ] **Step 1: Run the full gate**

Run: `pnpm check`
Expected: shared tests, rules tests, typechecks, lint, no-raw-refs, web-compat all green.

- [ ] **Step 2: Deploy to dev** (via `firestore-deploy` skill): rules + indexes + functions. Note in the PR body that dev needs the deploy and indexes build asynchronously.

- [ ] **Step 3: On-device verification** (via `drive-android-avd`): as a super admin see all three sections; as a village admin see only org-creation; as an org admin see only that org's join requests; non-approver sees no menu entry. Approve a join request → requester gains membership + notification.

---

## Rollout status

| Step | Dev | Beta | Prod |
|---|---|---|---|
| Code deployed (rules+indexes+functions) | ⬜ | ⬜ | ⬜ |
| Org-member role backfill executed | ⬜ | ⬜ | ⬜ |

Legend: ⬜ pending · ⏳ in progress · ✅ done · ⚠️ blocked (note inline)
