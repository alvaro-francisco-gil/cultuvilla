# Places & Barrios Proposals — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any village member propose a place or barrio (lands as `status:'pending'`, visible to all) while organizers create directly and approve/reject pending proposals — enforced in `firestore.rules`, with the model + service layer fully tested.

## Status

- **Updated:** 2026-06-21
- **Stage:** Task 1 (model fields + build helpers)
- **Branch:** repo `worktree-organizer-shared-ui-merge` (worktree `.claude/worktrees/organizer-shared-ui-merge`)
- **Done:** plan authored; baseline green (377 shared unit tests)
- **Next:** implement Task 1 (status/proposedBy/approvedBy/decidedAt on Place & Barrio schemas)
- **Blockers:** none
- **Handoff:** emulator-backed tests run from repo root — `pnpm test:integration` and `pnpm test:rules` (both wrap `scripts/run-tests-with-emulators.mjs`). Model/unit tests: `pnpm shared:test`. Rules deploy to dev is deferred to the UI plan.

**Architecture:** The propose-pending pattern lives in the **existing** `places` / `barrios` subcollections (not a separate collection) so pending and approved items share one list. Place/Barrio schemas gain `status` + `proposedBy` + `approvedBy` + `decidedAt`, mirroring `OrganizationDataModel`. Zod `.default(...)` on the new fields keeps legacy docs readable with no data migration (missing `status` → `'approved'`, missing `proposedBy` → `null`). Rules allow member creates only as `pending`, organizer/app-admin creates unrestricted, status transitions organizer-only, and proposers may edit/withdraw their own still-pending item.

**Tech Stack:** TypeScript, Zod, Firebase Web SDK (`firebase/firestore`), `@firebase/rules-unit-testing` + Firestore emulator, Vitest.

**This is the foundation plan.** It changes no UI. Follow-up plans (separate files) build on it: (2) shared capability hook + propose-pending UI primitives + merged Places/Barrios screens, (3) Organizations adopt the primitives, (4) Census role-mode, (5) Community-header role-mode, (6) Events v1, (7) Events v2, (8) delete the `/admin/` route group. The umbrella design is `docs/plans/ideas/organizer-shared-ui-merge.md`.

## Global Constraints

- Package manager: `pnpm`. Shared-package tests run from repo root or `packages/shared`.
- Model build helpers set timestamps with `new Date()`; service **update** calls use `serverTimestamp()` (updateDoc bypasses the converter, so `serverTimestamp()` is allowed there — matches `approveOrganization`).
- Proposal status enum is exactly `['pending', 'approved', 'rejected']` (verbatim from `OrganizationStatusSchema`).
- New nullable fields use `.nullable().default(null)`; `status` uses `.default('approved')` so pre-existing docs (no `status` key) read back as approved. This is the same legacy-compat trick as the existing `imageURL: z.string().nullable().default(null)`.
- Rules helpers already defined in `firestore.rules`: `isAuthenticated()`, `isOwner(userId)`, `isAppAdmin()`, `isVillageAdmin(municipalityId)`, `isVillageMember(municipalityId)`, `isString`, `isStringOrNull`, `isTimestamp`, `isTimestampOrNull`. Reuse them; do not redefine.
- `places` and `barrios` are subcollections under `match /municipalities/{municipalityId}`, so `municipalityId` is available as a path variable inside their match blocks.
- Test commands (run from **repo root**):
  - Model/unit (no emulator): `pnpm shared:test` (a single file: `pnpm --filter @cultuvilla/shared test <pattern>`).
  - Integration (Firestore emulator, auto-started by the wrapper): `pnpm test:integration` — runs `node scripts/run-tests-with-emulators.mjs pnpm --filter @cultuvilla/shared test:integration`. Runs the whole integration suite; there is no convenient single-file filter through the wrapper.
  - Rules e2e (Firestore + Storage emulators): `pnpm test:rules`.
  - The unit config (`vitest.config.ts`) excludes `test/integration` and `test/e2e`; integration tests live in `test/integration/`, rules tests in `test/e2e/`, model/unit tests elsewhere under `test/`.

---

### Task 1: Add status/proposer fields to Place & Barrio models

**Files:**
- Modify: `packages/shared/src/models/municipality/MunicipalityDataModel.ts` (BarrioDataSchema ~144–168, PlaceDataSchema ~177–216)
- Test: `packages/shared/test/models/municipalityProposals.test.ts` (create)

**Interfaces:**
- Produces:
  - `ProposalStatusSchema` (`z.enum(['pending','approved','rejected'])`), type `ProposalStatus`.
  - `BarrioData` / `PlaceData` gain `status: ProposalStatus`, `proposedBy: string | null`, `approvedBy: string | null`, `decidedAt: Date | null`.
  - `BarrioDataInput` / `PlaceDataInput` gain optional `status?`, `proposedBy?`, `approvedBy?`, `decidedAt?`.
  - `buildBarrioData` / `buildPlaceData` default `status:'pending'`, `proposedBy: input.proposedBy ?? null`, `approvedBy: null`, `decidedAt: null` unless overridden.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/models/municipalityProposals.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  BarrioDataSchema,
  PlaceDataSchema,
  buildBarrioData,
  buildPlaceData,
} from '../../src/models/municipality/MunicipalityDataModel';

describe('Place/Barrio proposal fields', () => {
  it('buildBarrioData defaults to a pending proposal carrying the proposer', () => {
    const b = buildBarrioData({ name: 'Centro', municipalityId: 'm1', proposedBy: 'alice' });
    expect(b.status).toBe('pending');
    expect(b.proposedBy).toBe('alice');
    expect(b.approvedBy).toBeNull();
    expect(b.decidedAt).toBeNull();
  });

  it('buildPlaceData honours an explicit approved status (organizer direct create)', () => {
    const p = buildPlaceData({
      name: 'Iglesia', kind: 'church', municipalityId: 'm1', status: 'approved',
    });
    expect(p.status).toBe('approved');
    expect(p.proposedBy).toBeNull();
  });

  it('legacy barrio docs (no status/proposedBy keys) parse with safe defaults', () => {
    const parsed = BarrioDataSchema.parse({
      name: 'Viejo', municipalityId: 'm1', createdAt: new Date(),
    });
    expect(parsed.status).toBe('approved');
    expect(parsed.proposedBy).toBeNull();
    expect(parsed.approvedBy).toBeNull();
    expect(parsed.decidedAt).toBeNull();
  });

  it('legacy place docs parse with safe defaults', () => {
    const parsed = PlaceDataSchema.parse({
      name: 'Plaza', kind: 'plaza', description: null, municipalityId: 'm1', createdAt: new Date(),
    });
    expect(parsed.status).toBe('approved');
    expect(parsed.proposedBy).toBeNull();
  });

  it('rejects an invalid status', () => {
    expect(() =>
      PlaceDataSchema.parse({
        name: 'X', kind: 'plaza', description: null, municipalityId: 'm1',
        createdAt: new Date(), status: 'maybe',
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared test -- municipalityProposals`
Expected: FAIL — `buildBarrioData` does not accept `proposedBy` / `status` undefined on result.

- [ ] **Step 3: Write minimal implementation**

In `MunicipalityDataModel.ts`, add the shared enum near the top of the schema section (after imports):

```typescript
export const ProposalStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;
```

Extend `BarrioDataSchema`:

```typescript
export const BarrioDataSchema = z.object({
  name: z.string(),
  municipalityId: z.string(),
  imageURL: z.string().nullable().default(null),
  createdAt: z.date(),
  // Propose-pending: legacy docs (no key) read back as an approved, unowned item.
  status: ProposalStatusSchema.default('approved'),
  proposedBy: z.string().nullable().default(null),
  approvedBy: z.string().nullable().default(null),
  decidedAt: z.date().nullable().default(null),
});
export type BarrioData = z.infer<typeof BarrioDataSchema>;

export interface BarrioDataInput {
  name: string;
  municipalityId: string;
  imageURL?: string | null;
  status?: ProposalStatus;
  proposedBy?: string | null;
  approvedBy?: string | null;
  decidedAt?: Date | null;
}

export function buildBarrioData(input: BarrioDataInput): BarrioData {
  return {
    name: input.name,
    municipalityId: input.municipalityId,
    imageURL: input.imageURL ?? null,
    createdAt: new Date(),
    status: input.status ?? 'pending',
    proposedBy: input.proposedBy ?? null,
    approvedBy: input.approvedBy ?? null,
    decidedAt: input.decidedAt ?? null,
  };
}
```

Extend `PlaceDataSchema` the same way (keep `kind` and `description`):

```typescript
export const PlaceDataSchema = z.object({
  name: z.string(),
  kind: PlaceKindSchema,
  description: z.string().nullable(),
  municipalityId: z.string(),
  imageURL: z.string().nullable().default(null),
  createdAt: z.date(),
  status: ProposalStatusSchema.default('approved'),
  proposedBy: z.string().nullable().default(null),
  approvedBy: z.string().nullable().default(null),
  decidedAt: z.date().nullable().default(null),
});
export type PlaceData = z.infer<typeof PlaceDataSchema>;

export interface PlaceDataInput {
  name: string;
  kind: PlaceKind;
  municipalityId: string;
  description?: string | null;
  imageURL?: string | null;
  status?: ProposalStatus;
  proposedBy?: string | null;
  approvedBy?: string | null;
  decidedAt?: Date | null;
}

export function buildPlaceData(input: PlaceDataInput): PlaceData {
  return {
    name: input.name,
    kind: input.kind,
    description: input.description ?? null,
    municipalityId: input.municipalityId,
    imageURL: input.imageURL ?? null,
    createdAt: new Date(),
    status: input.status ?? 'pending',
    proposedBy: input.proposedBy ?? null,
    approvedBy: input.approvedBy ?? null,
    decidedAt: input.decidedAt ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared test -- municipalityProposals`
Expected: PASS (5 tests).

- [ ] **Step 5: Keep existing services compiling**

`createBarrio`/`createPlace` build a `BarrioData`/`PlaceData` object literal inline; adding the new required fields makes those literals fail typecheck. Route them through the build helpers (organizer direct-create → approved). In `municipalityService.ts`, ensure `buildBarrioData` and `buildPlaceData` are imported from `../models/municipality/MunicipalityDataModel`, then:

```typescript
export async function createBarrio(municipalityId: string, input: BarrioDataInput): Promise<string> {
  const newRef = doc(municipalityBarriosCollection(getDb(), municipalityId));
  await setDoc(newRef, buildBarrioData({ ...input, municipalityId, status: input.status ?? 'approved' }));
  return newRef.id;
}

export async function createPlace(municipalityId: string, input: PlaceDataInput): Promise<string> {
  const newRef = doc(municipalityPlacesCollection(getDb(), municipalityId));
  await setDoc(newRef, buildPlaceData({ ...input, municipalityId, status: input.status ?? 'approved' }));
  return newRef.id;
}
```

- [ ] **Step 6: Typecheck + full shared unit suite**

Run: `pnpm shared:typecheck && pnpm shared:test`
Expected: PASS (new model tests + all pre-existing).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/models/municipality/MunicipalityDataModel.ts packages/shared/src/services/municipalityService.ts packages/shared/test/models/municipalityProposals.test.ts
git commit -m "feat(shared): add status/proposedBy/approvedBy/decidedAt to Place & Barrio models"
```

---

### Task 2: Propose/approve/reject service functions

**Files:**
- Modify: `packages/shared/src/services/municipalityService.ts` (createBarrio ~177, createPlace ~210, add new functions after each)
- Test: `packages/shared/test/integration/municipalityProposalsIntegration.test.ts` (create)

**Interfaces:**
- Consumes: `buildBarrioData`, `buildPlaceData` (Task 1); `municipalityBarriosCollection`, `municipalityBarrioDoc`, `municipalityPlacesCollection`, `municipalityPlaceDoc` from `../firebase/refs/client`.
- Produces:
  - `proposeBarrio(municipalityId: string, input: BarrioDataInput & { proposedBy: string }): Promise<string>` — writes `status:'pending'`.
  - `approveBarrio(municipalityId: string, barrioId: string, approvedBy: string): Promise<void>`
  - `rejectBarrio(municipalityId: string, barrioId: string): Promise<void>`
  - `proposePlace(municipalityId: string, input: PlaceDataInput & { proposedBy: string }): Promise<string>`
  - `approvePlace(municipalityId: string, placeId: string, approvedBy: string): Promise<void>`
  - `rejectPlace(municipalityId: string, placeId: string): Promise<void>`
  - `createBarrio` / `createPlace` keep their existing signatures but now write the full field set with `status:'approved'`, `proposedBy:null` (organizer direct-create).

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/integration/municipalityProposalsIntegration.test.ts`:

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  proposePlace, approvePlace,
  proposeBarrio, approveBarrio, rejectBarrio,
} from '../../src/services/municipalityService';
import * as firebaseModule from '../../src/firebase';

let env: RulesTestEnvironment;

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({
    projectId: process.env.TEST_PROJECT_ID || 'cultuvilla-test',
    firestore: { rules },
  });
});
beforeEach(async () => { await env.clearFirestore(); });
afterAll(async () => { vi.restoreAllMocks(); await env.cleanup(); });

function ctxDb(uid: string): Firestore {
  return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}
function useDbAs(uid: string) {
  vi.spyOn(firebaseModule, 'getDb').mockReturnValue(ctxDb(uid));
}
async function read(path: string) {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (c) => {
    data = (await getDoc(doc(c.firestore() as unknown as Firestore, path))).data();
  });
  return data;
}
async function seed(path: string, value: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore() as unknown as Firestore, path), value);
  });
}
const pendingPlace = { name: 'Ermita', kind: 'hermitage', description: null, municipalityId: 'm1', imageURL: null, createdAt: new Date(), status: 'pending', proposedBy: 'alice', approvedBy: null, decidedAt: null };
const pendingBarrio = { name: 'Norte', municipalityId: 'm1', imageURL: null, createdAt: new Date(), status: 'pending', proposedBy: 'alice', approvedBy: null, decidedAt: null };

describe('municipalityService — place/barrio proposals', () => {
  it('proposePlace writes a pending place carrying the proposer', async () => {
    useDbAs('alice');
    const id = await proposePlace('m1', { name: 'Fuente', kind: 'plaza', municipalityId: 'm1', proposedBy: 'alice' });
    const d = await read(`municipalities/m1/places/${id}`);
    expect(d?.status).toBe('pending');
    expect(d?.proposedBy).toBe('alice');
  });

  it('approvePlace flips status to approved and stamps approvedBy', async () => {
    await seed('municipalities/m1/places/p1', pendingPlace);
    useDbAs('admin');
    await approvePlace('m1', 'p1', 'admin');
    const d = await read('municipalities/m1/places/p1');
    expect(d?.status).toBe('approved');
    expect(d?.approvedBy).toBe('admin');
  });

  it('rejectBarrio flips status to rejected with null approvedBy', async () => {
    await seed('municipalities/m1/barrios/b1', pendingBarrio);
    useDbAs('admin');
    await rejectBarrio('m1', 'b1');
    const d = await read('municipalities/m1/barrios/b1');
    expect(d?.status).toBe('rejected');
    expect(d?.approvedBy).toBeNull();
  });

  it('proposeBarrio + approveBarrio round-trip', async () => {
    useDbAs('alice');
    const id = await proposeBarrio('m1', { name: 'Sur', municipalityId: 'm1', proposedBy: 'alice' });
    useDbAs('admin');
    await approveBarrio('m1', id, 'admin');
    const d = await read(`municipalities/m1/barrios/${id}`);
    expect(d?.status).toBe('approved');
  });
});
```

Note: this integration test seeds via `withSecurityRulesDisabled` and spies `getDb()` to point the service at an authenticated emulator context; it verifies the service's write shape (rules allow/deny is covered in Tasks 3–4).

- [ ] **Step 2: Run test to verify it fails**

Run (from repo root): `pnpm test:integration`
Expected: FAIL — `proposePlace` / `approvePlace` / etc. are not exported (the new file fails to import).

- [ ] **Step 3: Write minimal implementation**

In `municipalityService.ts`, ensure `serverTimestamp` is imported from `firebase/firestore` (add to the existing import if missing). `createBarrio`/`createPlace` were already routed through the build helpers in Task 1; here add the proposal + decision functions.

```typescript
export async function proposeBarrio(
  municipalityId: string,
  input: BarrioDataInput & { proposedBy: string },
): Promise<string> {
  const newRef = doc(municipalityBarriosCollection(getDb(), municipalityId));
  const data = buildBarrioData({ ...input, municipalityId, status: 'pending' });
  await setDoc(newRef, data);
  return newRef.id;
}

export async function approveBarrio(
  municipalityId: string,
  barrioId: string,
  approvedBy: string,
): Promise<void> {
  await updateDoc(doc(getDb(), 'municipalities', municipalityId, 'barrios', barrioId), {
    status: 'approved',
    approvedBy,
    decidedAt: serverTimestamp(),
  });
}

export async function rejectBarrio(municipalityId: string, barrioId: string): Promise<void> {
  await updateDoc(doc(getDb(), 'municipalities', municipalityId, 'barrios', barrioId), {
    status: 'rejected',
    approvedBy: null,
    decidedAt: serverTimestamp(),
  });
}
```

Add the place proposal functions:

```typescript
export async function proposePlace(
  municipalityId: string,
  input: PlaceDataInput & { proposedBy: string },
): Promise<string> {
  const newRef = doc(municipalityPlacesCollection(getDb(), municipalityId));
  const data = buildPlaceData({ ...input, municipalityId, status: 'pending' });
  await setDoc(newRef, data);
  return newRef.id;
}

export async function approvePlace(
  municipalityId: string,
  placeId: string,
  approvedBy: string,
): Promise<void> {
  await updateDoc(doc(getDb(), 'municipalities', municipalityId, 'places', placeId), {
    status: 'approved',
    approvedBy,
    decidedAt: serverTimestamp(),
  });
}

export async function rejectPlace(municipalityId: string, placeId: string): Promise<void> {
  await updateDoc(doc(getDb(), 'municipalities', municipalityId, 'places', placeId), {
    status: 'rejected',
    approvedBy: null,
    decidedAt: serverTimestamp(),
  });
}
```


- [ ] **Step 4: Run test to verify it passes**

Run (from repo root): `pnpm test:integration`
Expected: PASS — including the 4 new tests in `municipalityProposalsIntegration` and all pre-existing integration tests.

- [ ] **Step 5: Typecheck + full shared unit suite (no regressions)**

Run: `pnpm shared:typecheck && pnpm shared:test`
Expected: PASS, including Task 1's model tests and all pre-existing tests.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/services/municipalityService.ts packages/shared/test/integration/municipalityProposalsIntegration.test.ts
git commit -m "feat(shared): proposePlace/proposeBarrio + approve/reject service functions"
```

---

### Task 3: Firestore rules for place proposals

**Files:**
- Modify: `firestore.rules` (add `isValidPlaceProposalCreate` near the other validators ~245–282; replace the `match /places/{placeId}` block ~432–435)
- Test: `packages/shared/test/e2e/placeProposalRules.test.ts` (create)

**Interfaces:**
- Consumes: helpers `isAuthenticated`, `isOwner`, `isAppAdmin`, `isVillageAdmin`, `isVillageMember`, `isString`, `isStringOrNull`, `isTimestamp`, `isTimestampOrNull`, and `PlaceKind` literals.
- Produces: rules allowing member `create` only when `status=='pending'` and `proposedBy==auth.uid`; organizer/app-admin `create` unrestricted; `update`/`delete` organizer-or-app-admin, plus proposer self-edit/withdraw while still pending.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/e2e/placeProposalRules.test.ts`:

```typescript
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;

const M = 'm1';
function placeDoc(status: string, proposedBy: string | null) {
  return {
    name: 'Fuente', kind: 'plaza', description: null, municipalityId: M,
    imageURL: null, createdAt: new Date(), status, proposedBy,
    approvedBy: null, decidedAt: null,
  };
}
async function seedMember(uid: string, role: 'user' | 'admin' = 'user') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/members/${uid}`), {
      role, joinedAt: new Date(), profileAnswers: {}, profileCompletedAt: null, trustedNewsAuthor: false,
    });
  });
}
async function seedPlace(id: string, status: string, proposedBy: string | null) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/places/${id}`), placeDoc(status, proposedBy));
  });
}

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({
    projectId: process.env.TEST_PROJECT_ID || 'cultuvilla-rules-test',
    firestore: { rules },
  });
});
beforeEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); });

describe('firestore.rules — /municipalities/{m}/places (proposals)', () => {
  it('anyone can read places', async () => {
    await seedPlace('p1', 'approved', null);
    await assertSucceeds(
      (await import('firebase/firestore')).getDoc(
        doc(env.unauthenticatedContext().firestore(), `municipalities/${M}/places/p1`)),
    );
  });

  it('member can create a pending place proposal carrying their uid', async () => {
    await seedMember('alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, `municipalities/${M}/places/p1`), placeDoc('pending', 'alice')));
  });

  it('member CANNOT create a place that is already approved', async () => {
    await seedMember('alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, `municipalities/${M}/places/p1`), placeDoc('approved', 'alice')));
  });

  it('member CANNOT create a proposal owned by someone else', async () => {
    await seedMember('alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, `municipalities/${M}/places/p1`), placeDoc('pending', 'bob')));
  });

  it('non-member cannot create any place', async () => {
    const stranger = env.authenticatedContext('stranger').firestore();
    await assertFails(setDoc(doc(stranger, `municipalities/${M}/places/p1`), placeDoc('pending', 'stranger')));
  });

  it('village admin can create an approved place directly', async () => {
    await seedMember('boss', 'admin');
    const boss = env.authenticatedContext('boss').firestore();
    await assertSucceeds(setDoc(doc(boss, `municipalities/${M}/places/p1`), placeDoc('approved', null)));
  });

  it('village admin can approve a pending proposal', async () => {
    await seedMember('boss', 'admin');
    await seedPlace('p1', 'pending', 'alice');
    const boss = env.authenticatedContext('boss').firestore();
    await assertSucceeds(updateDoc(doc(boss, `municipalities/${M}/places/p1`), { status: 'approved', approvedBy: 'boss' }));
  });

  it('proposer can edit their own still-pending proposal', async () => {
    await seedMember('alice');
    await seedPlace('p1', 'pending', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(updateDoc(doc(alice, `municipalities/${M}/places/p1`), { name: 'Fuente Nueva' }));
  });

  it('proposer CANNOT approve their own proposal', async () => {
    await seedMember('alice');
    await seedPlace('p1', 'pending', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(updateDoc(doc(alice, `municipalities/${M}/places/p1`), { status: 'approved', approvedBy: 'alice' }));
  });

  it('proposer can withdraw (delete) their own pending proposal', async () => {
    await seedMember('alice');
    await seedPlace('p1', 'pending', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(deleteDoc(doc(alice, `municipalities/${M}/places/p1`)));
  });

  it('proposer CANNOT delete a proposal once approved', async () => {
    await seedMember('alice');
    await seedPlace('p1', 'approved', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(deleteDoc(doc(alice, `municipalities/${M}/places/p1`)));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from repo root): `pnpm test:rules`
Expected: FAIL — current rule is `allow write: if isAppAdmin()`, so the new `placeProposalRules` member create/approve/withdraw assertions fail.

- [ ] **Step 3: Write minimal implementation**

In `firestore.rules`, add the validator beside the other `isValid…Create` functions:

```
function isValidPlaceProposalCreate(d) {
  return d.keys().hasOnly([
          'name', 'kind', 'description', 'municipalityId', 'imageURL',
          'createdAt', 'status', 'proposedBy', 'approvedBy', 'decidedAt',
        ])
      && d.keys().hasAll([
          'name', 'kind', 'description', 'municipalityId', 'imageURL',
          'createdAt', 'status', 'proposedBy', 'approvedBy', 'decidedAt',
        ])
      && isString(d.name)
      && d.kind in ['cemetery', 'church', 'hermitage', 'plaza', 'town_hall']
      && isStringOrNull(d.description)
      && isString(d.municipalityId)
      && isStringOrNull(d.imageURL)
      && isTimestamp(d.createdAt)
      && d.status in ['pending', 'approved', 'rejected']
      && isStringOrNull(d.proposedBy)
      && isStringOrNull(d.approvedBy)
      && isTimestampOrNull(d.decidedAt);
}
```

Replace the `match /places/{placeId}` block (inside `match /municipalities/{municipalityId}`):

```
match /places/{placeId} {
  allow read: if true;
  allow create: if isAppAdmin()
    || isVillageAdmin(municipalityId)
    || (
         isVillageMember(municipalityId)
         && isValidPlaceProposalCreate(request.resource.data)
         && request.resource.data.status == 'pending'
         && request.resource.data.proposedBy == request.auth.uid
       );
  allow update: if isVillageAdmin(municipalityId) || isAppAdmin()
    || (
         isOwner(resource.data.proposedBy)
         && resource.data.status == 'pending'
         && request.resource.data.status == 'pending'
       );
  allow delete: if isVillageAdmin(municipalityId) || isAppAdmin()
    || (isOwner(resource.data.proposedBy) && resource.data.status == 'pending');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from repo root): `pnpm test:rules`
Expected: PASS — the 11 `placeProposalRules` tests plus all pre-existing rules tests.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules packages/shared/test/e2e/placeProposalRules.test.ts
git commit -m "feat(rules): place proposals — member-pending create, organizer approve, proposer withdraw"
```

---

### Task 4: Firestore rules for barrio proposals

**Files:**
- Modify: `firestore.rules` (add `isValidBarrioProposalCreate`; replace the `match /barrios/{barrioId}` block ~427–430)
- Test: `packages/shared/test/e2e/barrioProposalRules.test.ts` (create)

**Interfaces:**
- Consumes: same helpers as Task 3.
- Produces: identical propose-pending rule semantics for barrios (no `kind`/`description` fields).

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/e2e/barrioProposalRules.test.ts`:

```typescript
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;
const M = 'm1';
function barrioDoc(status: string, proposedBy: string | null) {
  return {
    name: 'Norte', municipalityId: M, imageURL: null, createdAt: new Date(),
    status, proposedBy, approvedBy: null, decidedAt: null,
  };
}
async function seedMember(uid: string, role: 'user' | 'admin' = 'user') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/members/${uid}`), {
      role, joinedAt: new Date(), profileAnswers: {}, profileCompletedAt: null, trustedNewsAuthor: false,
    });
  });
}
async function seedBarrio(id: string, status: string, proposedBy: string | null) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/barrios/${id}`), barrioDoc(status, proposedBy));
  });
}

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({
    projectId: process.env.TEST_PROJECT_ID || 'cultuvilla-rules-test',
    firestore: { rules },
  });
});
beforeEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); });

describe('firestore.rules — /municipalities/{m}/barrios (proposals)', () => {
  it('anyone can read barrios', async () => {
    await seedBarrio('b1', 'approved', null);
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), `municipalities/${M}/barrios/b1`)));
  });
  it('member can create a pending barrio proposal', async () => {
    await seedMember('alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, `municipalities/${M}/barrios/b1`), barrioDoc('pending', 'alice')));
  });
  it('member CANNOT create an approved barrio', async () => {
    await seedMember('alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, `municipalities/${M}/barrios/b1`), barrioDoc('approved', 'alice')));
  });
  it('non-member cannot create a barrio', async () => {
    const stranger = env.authenticatedContext('stranger').firestore();
    await assertFails(setDoc(doc(stranger, `municipalities/${M}/barrios/b1`), barrioDoc('pending', 'stranger')));
  });
  it('village admin can create an approved barrio directly', async () => {
    await seedMember('boss', 'admin');
    const boss = env.authenticatedContext('boss').firestore();
    await assertSucceeds(setDoc(doc(boss, `municipalities/${M}/barrios/b1`), barrioDoc('approved', null)));
  });
  it('village admin can approve a pending barrio', async () => {
    await seedMember('boss', 'admin');
    await seedBarrio('b1', 'pending', 'alice');
    const boss = env.authenticatedContext('boss').firestore();
    await assertSucceeds(updateDoc(doc(boss, `municipalities/${M}/barrios/b1`), { status: 'approved', approvedBy: 'boss' }));
  });
  it('proposer can edit own pending barrio but not approve it', async () => {
    await seedMember('alice');
    await seedBarrio('b1', 'pending', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(updateDoc(doc(alice, `municipalities/${M}/barrios/b1`), { name: 'Norte Alto' }));
    await assertFails(updateDoc(doc(alice, `municipalities/${M}/barrios/b1`), { status: 'approved', approvedBy: 'alice' }));
  });
  it('proposer can withdraw own pending barrio but not an approved one', async () => {
    await seedMember('alice');
    await seedBarrio('b1', 'pending', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(deleteDoc(doc(alice, `municipalities/${M}/barrios/b1`)));
    await seedBarrio('b2', 'approved', 'alice');
    await assertFails(deleteDoc(doc(alice, `municipalities/${M}/barrios/b2`)));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from repo root): `pnpm test:rules`
Expected: FAIL — current rule is `allow write: if isAppAdmin()`, so the new `barrioProposalRules` assertions fail.

- [ ] **Step 3: Write minimal implementation**

In `firestore.rules`, add the validator:

```
function isValidBarrioProposalCreate(d) {
  return d.keys().hasOnly([
          'name', 'municipalityId', 'imageURL', 'createdAt',
          'status', 'proposedBy', 'approvedBy', 'decidedAt',
        ])
      && d.keys().hasAll([
          'name', 'municipalityId', 'imageURL', 'createdAt',
          'status', 'proposedBy', 'approvedBy', 'decidedAt',
        ])
      && isString(d.name)
      && isString(d.municipalityId)
      && isStringOrNull(d.imageURL)
      && isTimestamp(d.createdAt)
      && d.status in ['pending', 'approved', 'rejected']
      && isStringOrNull(d.proposedBy)
      && isStringOrNull(d.approvedBy)
      && isTimestampOrNull(d.decidedAt);
}
```

Replace the `match /barrios/{barrioId}` block:

```
match /barrios/{barrioId} {
  allow read: if true;
  allow create: if isAppAdmin()
    || isVillageAdmin(municipalityId)
    || (
         isVillageMember(municipalityId)
         && isValidBarrioProposalCreate(request.resource.data)
         && request.resource.data.status == 'pending'
         && request.resource.data.proposedBy == request.auth.uid
       );
  allow update: if isVillageAdmin(municipalityId) || isAppAdmin()
    || (
         isOwner(resource.data.proposedBy)
         && resource.data.status == 'pending'
         && request.resource.data.status == 'pending'
       );
  allow delete: if isVillageAdmin(municipalityId) || isAppAdmin()
    || (isOwner(resource.data.proposedBy) && resource.data.status == 'pending');
}
```

- [ ] **Step 4: Run test to verify it passes (full rules suite, no regressions)**

Run (from repo root): `pnpm test:rules`
Expected: PASS — the 8 `barrioProposalRules` tests, the 11 `placeProposalRules` tests, and all pre-existing rules tests.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules packages/shared/test/e2e/barrioProposalRules.test.ts
git commit -m "feat(rules): barrio proposals — member-pending create, organizer approve, proposer withdraw"
```

---

## Out of scope (this plan)

- All UI changes (the merged screens, the capability hook, the propose-pending primitives, deleting `/admin/`). Those are the next plan.
- The organizer "single create path + auto-approve" UX nicety. At the service layer, `createPlace`/`createBarrio` (organizer direct, approved) and `propose*` (member, pending) coexist; the UI plan decides which to call by role. The rules already permit both.
- Organizations, census, community header, events — their own plans.
- Deploying the rules to dev (use the `firestore-deploy` skill when the UI is ready to exercise them).
