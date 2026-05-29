---
Status: Draft
---

# Firestore Permission Red/Green Coverage — Design

## Problem

The mobile app logs several anonymous `FirebaseError: Missing or insufficient permissions` errors on cold start (observed: ids 0–4 in a single Metro run). The Firestore JS SDK does not include the query path in the error, so we cannot tell from logs alone which reads are being denied. We need:

1. A way to attribute every `permission-denied` error to a specific query path and auth state.
2. Regression coverage against the live `firestore.rules` for the reads that fail, so the same denials cannot silently reappear.

Cultuvilla already runs `@firebase/rules-unit-testing` against the emulator in
[packages/shared/test/e2e/](../../../packages/shared/test/e2e/) (`joinRequestRules`, `villageRules`, `personRules`, `newsRules`, `organizerRequestRules`). The infrastructure exists; coverage of the boot-time reads does not.

## Goals

- Mobile dev runs surface the path + uid + operation for every `permission-denied` error.
- Each query identified by the diagnosis has a paired rules test: one `assertSucceeds` for the legitimate caller, one `assertFails` for an illegitimate caller.
- All resulting tests are part of the existing `packages/shared` e2e suite — no new harness, no new CI job.

## Non-Goals

- Wrapping or instrumenting `packages/shared/src/services/*` — services stay pure.
- Adding rules coverage for service reads that are not implicated in the boot errors. (Coverage grows lazily as new denials surface.)
- Production telemetry. Logging is dev-only.
- Replacing or restructuring the existing e2e harness.

## Design

### Phase A — Diagnose

**A1. Mobile-side error-logging helper.**

New file: [apps/mobile/lib/firestoreErrorLog.ts](../../../apps/mobile/lib/firestoreErrorLog.ts).

Exports `withFirestoreErrorLog<T>(label: string, op: () => Promise<T>): Promise<T>`. Awaits `op()`; on `FirebaseError` with `code === 'permission-denied'`, logs a single structured line via `console.warn`:

```
[firestore-deny] label=<label> code=<code> uid=<auth.currentUser?.uid ?? 'anon'>
```

…then rethrows so call-site behavior is unchanged. In `__DEV__ === false` the helper is a transparent pass-through (returns `op()` directly).

`label` is supplied by the call site (e.g., `'profile:getEventCountByCreator'`) — the helper does not try to introspect the Firestore SDK to derive a path.

**A2. Global unhandled-rejection safety net.**

In [apps/mobile/lib/firebaseInit.ts](../../../apps/mobile/lib/firebaseInit.ts), add a one-time `globalThis.addEventListener?.('unhandledrejection', ...)` registration (guarded by `__DEV__`). On an unhandled `FirebaseError` with `code === 'permission-denied'`, log:

```
[firestore-deny:unhandled] code=permission-denied uid=<uid> stack=<error.stack>
```

This catches denials from listeners and call sites that are not wrapped — including any that fire before we get a chance to wrap them.

**A3. Wrap the boot-time call sites.**

Wrap each Firestore call invoked from the three tab screens' mount effects with `withFirestoreErrorLog`. Concretely:

- [apps/mobile/app/(tabs)/index.tsx](../../../apps/mobile/app/(tabs)/index.tsx) — `getUpcomingFeed`.
- [apps/mobile/app/(tabs)/profile.tsx](../../../apps/mobile/app/(tabs)/profile.tsx) — `getEventCountByCreator`, `getUserRegistrationsAcrossEvents`, `getOrganizationsByMunicipality`, `getOrgMembershipsByUserInMunicipality`, the person read, etc.
- [apps/mobile/app/(tabs)/village.tsx](../../../apps/mobile/app/(tabs)/village.tsx) — `getMunicipality`, the village-member reads, `setActiveMunicipality`.

The wrap is mechanical — same return value, same error propagation, just adds the label.

**A4. Capture run.**

Run the app on the device/emulator, exercise the cold-start path, copy the `[firestore-deny]` lines from Metro. These lines become the input to Phase B.

### Phase B — Red/Green coverage for the diagnosed reads

For each `(label, code=permission-denied)` line captured in A4:

1. **Pick the service file** behind the label (e.g., `feedService.ts`).
2. **Create or extend** a sibling rules test file in [packages/shared/test/e2e/](../../../packages/shared/test/e2e/) using the existing `villageRules.test.ts` shape as the template (real `firestore.rules` loaded from disk, `env.clearFirestore()` per test, `withSecurityRulesDisabled` to seed, then assertions under a real auth context).
   - Filename convention: `<service>Rules.test.ts` (e.g., `feedRules.test.ts`, `organizationRules.test.ts`).
3. **Write two assertions** per denied read:
   - `assertSucceeds` for the legitimate auth context (e.g., authenticated village member reading their own municipality's events).
   - `assertFails` for an illegitimate context (anonymous, non-member of that municipality, or — where it matters — a member of a *different* municipality).
4. **Run the e2e suite** (the existing emulator command in `packages/shared`). The legitimate-case assertion fails RED, because either:
   - **Rule too tight** — there is no read clause for that path/shape. Fix the rule.
   - **Query too early or under wrong auth** — the call site fires before `activeMunicipalityId` or `auth.uid` is set. Fix the call site (early return / await ordering / dependency on resolved auth state).
5. **GREEN** confirms the fix. Test is checked in as regression coverage.

The order is strict: tests land first (RED), fix lands second (GREEN), commit together. No fixing rules ahead of writing the failing test.

### Files Created / Modified

- New: `apps/mobile/lib/firestoreErrorLog.ts`.
- Modified: `apps/mobile/lib/firebaseInit.ts` (add unhandled-rejection hook).
- Modified: `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/(tabs)/profile.tsx`, `apps/mobile/app/(tabs)/village.tsx` (wrap call sites). Plus any other screen identified by A4.
- New: one `<service>Rules.test.ts` per service implicated by A4, in `packages/shared/test/e2e/`.
- Possibly modified: `firestore.rules` if Phase B finds a rule that is too tight.
- Possibly modified: a service or screen if Phase B finds a query firing too early.

### Testing

- Phase A is verified by visual inspection of Metro logs: every previous anonymous denial is now attributed to a labeled call site (or surfaces via the unhandled-rejection hook).
- Phase B is verified by `pnpm test:rules` (defined in root `package.json`; runs `scripts/run-tests-with-emulators.mjs` against `@cultuvilla/shared`): each new `<service>Rules.test.ts` first fails RED on the legitimate case, then passes GREEN after the rule/query fix.
- No new CI job. The new tests piggy-back on whatever step currently runs the `packages/shared` e2e suite.

### Rollout

Single PR per worktree branch. Phase A and Phase B land together — diagnose, fix, regress, commit. If A4 reveals more denied reads than the worktree can reasonably address in one pass, we triage in the implementation plan and split into follow-ups; the diagnostic infrastructure (A1+A2+A3) still ships in the first cut.

## Risks & Mitigations

- **Risk:** Phase A adds log spam in dev. **Mitigation:** Single `console.warn` per error; gated on `__DEV__`; the helper is a pass-through in prod.
- **Risk:** `withFirestoreErrorLog` becomes a default required wrapper, creating service-layer coupling. **Mitigation:** Helper lives in `apps/mobile/`, not `packages/shared/`. Services remain unaware.
- **Risk:** Phase B tempts us to refactor `firestore.rules` broadly. **Mitigation:** Scope is strictly the queries surfaced in A4. Out-of-scope rule edits go to a separate spec.
- **Risk:** Some denied reads come from listeners that mount inside child components, not tab roots. **Mitigation:** A2's global hook catches these even when A3 misses them. We extend A3 wraps as needed once A4 logs show the call site.

## Open Questions

None blocking. (Per-service nuance in `firestore.rules` will be pinned as each test is written.)
