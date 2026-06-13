# Firestore Permission Red/Green Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attribute every Firestore `permission-denied` error on mobile cold-start to a labelled call site, then add `@firebase/rules-unit-testing` regression coverage for each denied read.

**Architecture:** Two phases. Phase A adds a dev-only `withFirestoreErrorLog(label, op)` helper in `apps/mobile/` plus a global `unhandledrejection` hook in `firebaseInit.ts`; call sites in the three tab screens get wrapped so denials log `label`, `code`, `uid`. Phase B runs the app, captures the labelled denials, and for each one adds a `<service>Rules.test.ts` in `packages/shared/test/e2e/` that asserts the legitimate caller succeeds and an illegitimate caller fails — RED first, then fix the rule or the call site until GREEN.

**Tech Stack:** Expo / React Native (`apps/mobile/`), `@firebase/auth` + `@firebase/firestore` JS SDK, `@firebase/rules-unit-testing` against the Firebase emulator (`pnpm test:rules`), vitest.

## Status

- **Updated:** 2026-06-13
- **Stage:** Phase A (denial attribution) shipped; Phase B (regression coverage) not started
- **Branch:** `main`
- **Done:** `withFirestoreErrorLog` helper in `apps/mobile/lib/`; global `unhandledrejection` hook in `firebaseInit.ts`; call sites in the three tab screens wrapped to log `label`/`code`/`uid`
- **Next:** run the app cold against the emulator, capture the labelled denials, and add one `<service>Rules.test.ts` per denial under `packages/shared/test/e2e/` (RED → fix rule/call site → GREEN)
- **Blockers:** none
- **Handoff:** Phase B is a capture-then-cover loop — it needs a real cold-start run to enumerate the denials before any tests can be written; the Phase A logging is what produces that list.

---

### Spec

Original design spec retired (recover via `git log -- docs/superpowers/specs/2026-05-25-firestore-permission-red-green-design.md`).

### File Structure

- `apps/mobile/lib/firestoreErrorLog.ts` — **new**. Exports `withFirestoreErrorLog<T>(label, op)`. Dev-only error logging wrapper; prod pass-through. One responsibility: label and surface `FirebaseError`s.
- `apps/mobile/lib/firebaseInit.ts` — **modify**. Add a `__DEV__`-gated `unhandledrejection` listener that prints labelled lines for any unhandled `permission-denied`.
- `apps/mobile/app/(tabs)/index.tsx` — **modify**. Wrap `getUpcomingFeed`.
- `apps/mobile/app/(tabs)/profile.tsx` — **modify**. Wrap `getPersonByUserId`, `getPersonsByCreator`, `getEventCountByCreator`, `getUserRegistrationsAcrossEvents`, `getOrganizationsByMunicipality`, `getOrgMembershipsByUserInMunicipality`, the avatar-upload `getPersonByUserId` refresh.
- `apps/mobile/app/(tabs)/village.tsx` — **modify**. Wrap `getUserMemberships`, `setActiveMunicipality`, `getMunicipality`, `isVillageAdmin`.
- `apps/mobile/test/firestoreErrorLog.test.ts` — **new**. Unit test for the helper.
- `packages/shared/test/e2e/<service>Rules.test.ts` — **new, one per service implicated by Phase A** (template task at the bottom of Phase B; the first concrete file written is `feedRules.test.ts`).
- `firestore.rules` — **possibly modify** if Phase B finds a rule too tight.
- `packages/shared/src/services/<service>.ts` or `apps/mobile/app/(tabs)/<screen>.tsx` — **possibly modify** if Phase B finds a query firing under the wrong auth state.

---

## Phase A — Diagnose

### Task 1: Create the `withFirestoreErrorLog` helper with a unit test

**Files:**
- Create: `apps/mobile/lib/firestoreErrorLog.ts`
- Test: `apps/mobile/test/firestoreErrorLog.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/test/firestoreErrorLog.test.ts`:

```ts
import { FirebaseError } from '@firebase/util';

// Mock @firebase/auth so getAuth().currentUser is controllable.
jest.mock('@firebase/auth', () => ({
  getAuth: () => ({ currentUser: { uid: 'test-uid' } }),
}));

declare const globalThis: { __DEV__?: boolean } & typeof global;

describe('withFirestoreErrorLog', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    globalThis.__DEV__ = true;
    jest.resetModules();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('returns the value when op resolves', async () => {
    const { withFirestoreErrorLog } = await import('../lib/firestoreErrorLog');
    const result = await withFirestoreErrorLog('test:ok', async () => 42);
    expect(result).toBe(42);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs label/code/uid and rethrows on permission-denied', async () => {
    const { withFirestoreErrorLog } = await import('../lib/firestoreErrorLog');
    const err = new FirebaseError('permission-denied', 'Missing or insufficient permissions.');
    await expect(
      withFirestoreErrorLog('test:deny', async () => {
        throw err;
      }),
    ).rejects.toBe(err);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = warn.mock.calls[0][0] as string;
    expect(line).toContain('[firestore-deny]');
    expect(line).toContain('label=test:deny');
    expect(line).toContain('code=permission-denied');
    expect(line).toContain('uid=test-uid');
  });

  it('does not log for non-Firebase errors but still rethrows', async () => {
    const { withFirestoreErrorLog } = await import('../lib/firestoreErrorLog');
    const err = new Error('boom');
    await expect(
      withFirestoreErrorLog('test:other', async () => {
        throw err;
      }),
    ).rejects.toBe(err);
    expect(warn).not.toHaveBeenCalled();
  });

  it('is a pass-through when __DEV__ is false', async () => {
    globalThis.__DEV__ = false;
    const { withFirestoreErrorLog } = await import('../lib/firestoreErrorLog');
    const err = new FirebaseError('permission-denied', 'denied');
    await expect(
      withFirestoreErrorLog('test:prod', async () => {
        throw err;
      }),
    ).rejects.toBe(err);
    expect(warn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm app:test -- --testPathPattern=firestoreErrorLog`

Expected: FAIL — module `../lib/firestoreErrorLog` not found.

- [ ] **Step 3: Write the helper**

Create `apps/mobile/lib/firestoreErrorLog.ts`:

```ts
import { FirebaseError } from '@firebase/util';
import { getAuth } from '@firebase/auth';

declare const __DEV__: boolean;

/**
 * Wraps a Firestore (or any) async op so that permission-denied errors
 * surface a labelled log line in dev. In production it is a pass-through.
 *
 * The label is supplied by the caller (e.g. `'profile:getPersonByUserId'`)
 * — the helper does not try to introspect query paths.
 */
export async function withFirestoreErrorLog<T>(
  label: string,
  op: () => Promise<T>,
): Promise<T> {
  if (!__DEV__) return op();
  try {
    return await op();
  } catch (err) {
    if (err instanceof FirebaseError && err.code === 'permission-denied') {
      let uid = 'anon';
      try {
        uid = getAuth().currentUser?.uid ?? 'anon';
      } catch {
        // Auth may not be initialised yet in odd edge cases — keep 'anon'.
      }
      console.warn(
        `[firestore-deny] label=${label} code=${err.code} uid=${uid}`,
      );
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm app:test -- --testPathPattern=firestoreErrorLog`

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/firestoreErrorLog.ts apps/mobile/test/firestoreErrorLog.test.ts
git commit -m "feat(mobile): firestore permission-denied logger helper"
```

---

### Task 2: Add the global `unhandledrejection` safety net to `firebaseInit`

**Files:**
- Modify: `apps/mobile/lib/firebaseInit.ts`

- [ ] **Step 1: Add the dev-only hook**

In `apps/mobile/lib/firebaseInit.ts`, add an import near the top:

```ts
import { FirebaseError } from '@firebase/util';
```

Add this module-level guard and helper just after the imports:

```ts
declare const __DEV__: boolean;

let unhandledHookInstalled = false;
function installUnhandledFirestoreDenyHook(): void {
  if (!__DEV__ || unhandledHookInstalled) return;
  unhandledHookInstalled = true;
  const target: { addEventListener?: typeof globalThis.addEventListener } =
    globalThis as never;
  if (typeof target.addEventListener !== 'function') return;
  target.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = (event as { reason?: unknown }).reason;
    if (reason instanceof FirebaseError && reason.code === 'permission-denied') {
      console.warn(
        `[firestore-deny:unhandled] code=${reason.code} stack=${reason.stack ?? '<no stack>'}`,
      );
    }
  });
}
```

Then inside `bootstrapFirebase()`, after `initMobileAppCheck()`, call it:

```ts
  initMobileAppCheck();
  installUnhandledFirestoreDenyHook();
```

- [ ] **Step 2: Sanity-check the file compiles**

Run: `pnpm app:typecheck`

Expected: PASS — no new TS errors.

If `PromiseRejectionEvent` is undefined in the RN env, replace the parameter type with `{ reason?: unknown }` and use that instead.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/firebaseInit.ts
git commit -m "feat(mobile): global unhandled-rejection logger for firestore denials"
```

---

### Task 3: Wrap boot-time call sites in the three tab screens

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Modify: `apps/mobile/app/(tabs)/profile.tsx`
- Modify: `apps/mobile/app/(tabs)/village.tsx`

- [ ] **Step 1: Wrap `getUpcomingFeed` in [(tabs)/index.tsx](../../../apps/mobile/app/(tabs)/index.tsx)**

Add import:

```ts
import { withFirestoreErrorLog } from '../../lib/firestoreErrorLog';
```

Replace the body of `load()` so the Firestore call is wrapped:

```ts
  async function load() {
    try {
      setError(null);
      const result = await withFirestoreErrorLog(
        'feed:getUpcomingFeed',
        () => getUpcomingFeed(50),
      );
      setEvents(result.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    }
  }
```

- [ ] **Step 2: Wrap all reads in [(tabs)/profile.tsx](../../../apps/mobile/app/(tabs)/profile.tsx)**

Add import:

```ts
import { withFirestoreErrorLog } from '../../lib/firestoreErrorLog';
```

Replace the `load` callback body with each Firestore call wrapped:

```ts
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [self, mine] = await Promise.all([
        withFirestoreErrorLog('profile:getPersonByUserId', () => getPersonByUserId(user.uid)),
        withFirestoreErrorLog('profile:getPersonsByCreator', () => getPersonsByCreator(user.uid)),
      ]);
      setSelfPerson(self);
      setAllPersonas(mine);

      const [count, regs] = await Promise.all([
        withFirestoreErrorLog('profile:getEventCountByCreator', () =>
          getEventCountByCreator(user.uid),
        ),
        withFirestoreErrorLog('profile:getUserRegistrationsAcrossEvents', () =>
          getUserRegistrationsAcrossEvents(user.uid),
        ),
      ]);
      setEventsCreated(count);
      const distinctEvents = new Set(regs.map((r) => r.eventPath));
      setParticipations(distinctEvents.size);

      if (activeMunicipalityId) {
        const munOrgs = await withFirestoreErrorLog(
          'profile:getOrganizationsByMunicipality',
          () => getOrganizationsByMunicipality(activeMunicipalityId, 'approved'),
        );
        const memberships = await withFirestoreErrorLog(
          'profile:getOrgMembershipsByUserInMunicipality',
          () =>
            getOrgMembershipsByUserInMunicipality(
              user.uid,
              activeMunicipalityId,
              munOrgs.map((o) => o.id),
            ),
        );
        const memberOrgIds = new Set(memberships.map((m) => m.orgId));
        setOrgs(
          munOrgs
            .filter((o) => memberOrgIds.has(o.id))
            .map((o) => ({ id: o.id, name: o.name })),
        );
      } else {
        setOrgs([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user, activeMunicipalityId]);
```

Also wrap the avatar-refresh inside `onChangePhoto`:

```ts
      const refreshed = await withFirestoreErrorLog(
        'profile:getPersonByUserId:refresh',
        () => getPersonByUserId(user!.uid),
      );
      setSelfPerson(refreshed);
```

- [ ] **Step 3: Wrap reads in [(tabs)/village.tsx](../../../apps/mobile/app/(tabs)/village.tsx)**

Add import:

```ts
import { withFirestoreErrorLog } from '../../lib/firestoreErrorLog';
```

Replace the `resolve()` body inside the first `useEffect`:

```ts
      if (profile.activeMunicipalityId) {
        if (!cancelled) setResolving(false);
        return;
      }
      const memberships = await withFirestoreErrorLog(
        'village:getUserMemberships',
        () => getUserMemberships(user.uid),
      );
      if (cancelled) return;
      const first = memberships[0];
      if (first) {
        await withFirestoreErrorLog('village:setActiveMunicipality', () =>
          setActiveMunicipality(user.uid, first.municipalityId),
        );
        await refreshProfile();
      }
```

Replace `loadVillage`'s `Promise.all`:

```ts
  const loadVillage = useCallback(async () => {
    if (!activeMunicipalityId) {
      setVillage(null);
      setVillageAdmin(false);
      return;
    }
    const [mun, isAdmin] = await Promise.all([
      withFirestoreErrorLog('village:getMunicipality', () =>
        getMunicipality(activeMunicipalityId),
      ),
      user
        ? withFirestoreErrorLog('village:isVillageAdmin', () =>
            isVillageAdmin(activeMunicipalityId, user.uid),
          )
        : Promise.resolve(false),
    ]);
    setVillage(mun);
    setVillageAdmin(isAdmin);
  }, [activeMunicipalityId, user]);
```

- [ ] **Step 4: Typecheck**

Run: `pnpm app:typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(tabs\)/index.tsx apps/mobile/app/\(tabs\)/profile.tsx apps/mobile/app/\(tabs\)/village.tsx
git commit -m "feat(mobile): label boot-time firestore reads for deny logging"
```

---

### Task 4: Capture the labelled denials from a real cold-start

**Files:** none modified — manual observation step.

- [ ] **Step 1: Start the app on Android**

Run: `pnpm app:android`

Expected: Metro starts, app boots on the connected device/emulator.

- [ ] **Step 2: Trigger the cold-start path**

Sign out if needed and sign back in so the three tabs all mount once. Visit each tab (Feed, Village, Profile) at least once.

- [ ] **Step 3: Collect every `[firestore-deny]` and `[firestore-deny:unhandled]` line from Metro**

Copy each unique `label=<x>` (or stack-trace top frame for unhandled) into a checklist below:

```
Phase A findings (fill in):
- label=<label-1>  uid=<uid>
- label=<label-2>  uid=<uid>
- label=<label-3>  uid=<uid>
- label=<label-4>  uid=<uid>
- label=<label-5>  uid=<uid>
```

If `[firestore-deny:unhandled]` lines appear with no `label=` prefix, identify the call site from the stack and add a `withFirestoreErrorLog(...)` wrap there before continuing — then re-run this task.

- [ ] **Step 4: Commit the findings as a worktree note**

Append the findings list to the bottom of this plan file (`docs/plans/ongoing/firestore-permission-red-green.md`) under a `## Phase A Findings` heading, then:

```bash
git add docs/plans/ongoing/firestore-permission-red-green.md
git commit -m "docs(plan): record phase A firestore deny findings"
```

---

## Phase B — Red/Green coverage for each denied read

Tasks 5+ are applied **once per finding** from Task 4. The first task below walks the procedure with the feed read (`feed:getUpcomingFeed`) as a fully-worked example; subsequent denials use the same template (Task 6).

### Task 5: Worked example — `feedRules.test.ts` for `feed:getUpcomingFeed`

> Only do this task if `feed:getUpcomingFeed` appears in Phase A findings. If it does not, skip to Task 6 and apply the template to the first finding instead.

**Files:**
- Create: `packages/shared/test/e2e/feedRules.test.ts`
- Possibly modify: `firestore.rules`
- Possibly modify: `packages/shared/src/services/feedService.ts` or `apps/mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Inspect the query**

Run: `grep -n "" packages/shared/src/services/feedService.ts | sed -n '1,80p'`

Note the collection path, the `where` clauses, and any `orderBy` — the rules test must mimic the exact shape, because a `list` query is only allowed if every doc that the query *could* return passes the rule.

- [ ] **Step 2: Write the failing rules test**

Create `packages/shared/test/e2e/feedRules.test.ts` following the shape of [villageRules.test.ts](../../../packages/shared/test/e2e/villageRules.test.ts):

```ts
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({
    projectId: process.env.TEST_PROJECT_ID || 'cultuvilla-rules-test',
    firestore: { rules },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env.cleanup();
});

describe('firestore.rules — getUpcomingFeed list on /events', () => {
  // Mirror the exact query shape used by feedService.getUpcomingFeed.
  // Adjust the where/orderBy clauses to match what the service actually issues.
  function upcomingFeedQuery(db: ReturnType<RulesTestEnvironment['unauthenticatedContext']>['firestore']) {
    const events = collection(db, 'events');
    return query(
      events,
      where('status', '==', 'published'),
      orderBy('startDate', 'asc'),
      limit(50),
    );
  }

  it('authenticated user can list upcoming events', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'events/e1'), {
        municipalityId: 'm1',
        organizationId: 'o1',
        status: 'published',
        startDate: new Date(Date.now() + 60_000),
      });
    });

    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(getDocs(upcomingFeedQuery(alice)));
  });

  it('anonymous user can list upcoming events (events are public-read)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'events/e1'), {
        municipalityId: 'm1',
        organizationId: 'o1',
        status: 'published',
        startDate: new Date(Date.now() + 60_000),
      });
    });

    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDocs(upcomingFeedQuery(anon)));
  });

  // If the deny in Phase A happened for an *un*authenticated query (boot
  // before sign-in completes), keep the anon-succeeds case as a regression
  // guard and treat the failure as a call-site bug to fix in Step 5.
});
```

- [ ] **Step 3: Run the test to verify RED**

Run: `pnpm test:rules`

Expected: at least one assertion fails. Note which one: `(a)` the authenticated case (rule is the bug) or `(b)` the anonymous case (the call site is firing before auth or the rule is genuinely tighter than expected).

- [ ] **Step 4: Make it GREEN**

If `(a)`: loosen the matching block in [firestore.rules](../../../firestore.rules) — usually adding the missing `allow list` clause or widening `allow read`. Re-deploy is not needed for the test; `initializeTestEnvironment` re-reads `firestore.rules` from disk on each `beforeAll`.

If `(b)`: the rule is correct and the call site fires too early. Fix the call site — guard with `if (!user) return;` or move the call into a `useEffect` keyed on `user?.uid`, or await the auth-ready signal before triggering `load()`. Do NOT widen the rule.

Re-run `pnpm test:rules`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/test/e2e/feedRules.test.ts firestore.rules \
        apps/mobile/app/\(tabs\)/index.tsx packages/shared/src/services/feedService.ts
git commit -m "test(rules): cover getUpcomingFeed list; fix <rule|call-site> for deny"
```

(Drop file paths that did not actually change.)

---

### Task 6: Repeat — one task per remaining Phase A finding

For each entry in Phase A Findings (Task 4) that is **not** the feed one already covered by Task 5:

**Files:**
- Create: `packages/shared/test/e2e/<service>Rules.test.ts` (filename = the service that exports the function — e.g. `personRules.test.ts` already exists, in which case **append** a new `describe(...)` block rather than create a new file; `registrationRules.test.ts` / `organizationRules.test.ts` / `orgMemberRules.test.ts` / etc. are new).
- Possibly modify: `firestore.rules`
- Possibly modify: the service file or the screen file.

For each finding, run the same five-step loop as Task 5:

- [ ] **Step 1: Inspect the query**
  - Open the service exporting the function from the label (e.g. label `profile:getOrgMembershipsByUserInMunicipality` ⇒ `packages/shared/src/services/orgMemberService.ts`, function `getOrgMembershipsByUserInMunicipality` at the line found via `grep -n "export async function getOrgMembershipsByUserInMunicipality"`).
  - Read the collection path, `where`, `orderBy`, `limit`. Match the rules-test query *exactly*; mismatched `where`/`orderBy` produce false GREENs.

- [ ] **Step 2: Write the failing rules test**
  - Open or create `packages/shared/test/e2e/<service>Rules.test.ts`.
  - Use the shape of [villageRules.test.ts](../../../packages/shared/test/e2e/villageRules.test.ts): `initializeTestEnvironment` with `firestore.rules` from disk, `clearFirestore` per test, `withSecurityRulesDisabled` to seed, then assertions.
  - Two assertions per denied read:
    - `assertSucceeds` from the legitimate auth context. Pick the context from the rule:
      - rule uses `isVillageMember(municipalityId)` → seed `municipalities/<m>/members/<uid>` then authenticate as `<uid>`.
      - rule uses `isOrgMember(orgId)` → seed `organizations/<o>/members/<uid>` then authenticate as `<uid>`.
      - rule uses `isOwner(userId)` → authenticate as `<userId>`.
      - rule uses `isAppAdmin()` → seed `admins/<uid>` then authenticate as `<uid>`.
      - rule uses `isAuthenticated()` → any `env.authenticatedContext('alice')`.
    - `assertFails` from an illegitimate context: `unauthenticatedContext()` if rule requires auth; an authenticated user that does NOT satisfy the membership predicate otherwise.

- [ ] **Step 3: Run `pnpm test:rules` and confirm RED**
  - At least one of the two assertions fails. Note which.

- [ ] **Step 4: Fix the rule OR the call site, then GREEN**
  - Legitimate case fails ⇒ rule is too tight. Edit [firestore.rules](../../../firestore.rules); do not loosen beyond the precise predicate the legitimate caller satisfies.
  - Illegitimate case unexpectedly succeeds ⇒ rule is too loose; tighten and re-derive.
  - Anonymous case succeeds in the test but the live app still denied ⇒ the live caller wasn't actually anonymous at deny time, OR App Check enforcement is denying. In that case open `apps/mobile/lib/appCheck.ts`, verify debug-token wiring in `__DEV__`, and treat that as the fix (the rules test stays GREEN as regression coverage anyway).
  - Re-run `pnpm test:rules`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/test/e2e/<service>Rules.test.ts firestore.rules \
        apps/mobile/app/\(tabs\)/<screen>.tsx packages/shared/src/services/<service>.ts \
        apps/mobile/lib/appCheck.ts
git commit -m "test(rules): cover <function>; fix <rule|call-site|app-check>"
```

(Drop file paths that did not actually change.)

Tick off the entry in Phase A Findings as you commit.

---

### Task 7: Final regression and worktree finish

**Files:** none modified.

- [ ] **Step 1: Run the full rules suite**

Run: `pnpm test:rules`

Expected: every test under `packages/shared/test/e2e/**` passes. No skipped tests.

- [ ] **Step 2: Re-run the app cold-start to confirm no `[firestore-deny]` lines**

Run: `pnpm app:android`. Sign in fresh, visit each tab.

Expected: Metro shows zero `[firestore-deny]` and zero `[firestore-deny:unhandled]` lines on cold start.

- [ ] **Step 3: Hand off**

Invoke `superpowers:finishing-a-development-branch` to choose how to merge the worktree branch back.

---

## Phase A Findings

Captured 2026-05-29 via `scripts/avd-dev.sh denies` against `Cultuvilla_Big` AVD, signed-in user `JkWXutMuh5cCe9AzgeOSlr2TIpa2`:

- `village:getUserMemberships` — `permission-denied`. Pueblo tab boot: `useEffect` resolving an active municipality fires `getUserMemberships(user.uid)`, a `collectionGroup('members')` query on the user's own membership rows. Symptom: Pueblo tab renders blank with `FirebaseError: Missing or insufficient permissions.` LogBox.
- `profile:getUserRegistrationsAcrossEvents` — `permission-denied`. Profile tab `load`: `getUserRegistrationsAcrossEvents(user.uid)`, a `collectionGroup('registrations')` query. Fires twice on first profile visit (mount + `useFocusEffect`).

Both root causes look the same: a collection-group query whose per-document rule (`/municipalities/{m}/members/{uid}` for village members, `/events/{eventId}/registrations/{regId}` for registrations) doesn't authorize the CG list shape the query actually issues. Phase B will pin down whether the fix is widening the existing `allow list` clause, tightening the query's `where` predicate so the rule's invariants hold, or both.
