---
Status: Draft
---

# Unify the test pipeline — `pnpm test` boots the emulator once and runs everything

## Problem

Today cultuvilla's `pnpm test` is misleading:

```
"test": "pnpm shared:test && pnpm app:test && pnpm functions:test"
```

`pnpm test` runs **three unit-only suites with no Firebase emulator** (shared vitest, mobile jest, functions unit). The emulator-backed work — rules tests, service integration tests, functions integration tests — lives behind a separate `pnpm test:emulators` umbrella, which a new contributor (or future Claude) is not guaranteed to run. Three concrete symptoms:

1. **The bug we just fixed in `firestore.rules` was invisible to `pnpm test`.** Only `pnpm test:rules` would have caught it. The default `pnpm test` was green while the live app burned.
2. **Transient emulator flakes have no retry**, so when CI does run the emulator suites, a single gRPC stutter turns the whole pipeline red.
3. **Service code is tested only against mocks**, never against a real Firestore. "Wrong field name" or "wrong collection name" bugs ship green from `pnpm shared:test` and only surface as rule denies in prod.

Ordago-apps converged on the opposite pattern: one `pnpm test`, one emulator boot, all node-side tests inside. Cultuvilla should borrow that shape.

## Goals

- A single `pnpm test` runs **everything that can run on Node** (shared unit + shared integration + shared rules + functions unit + functions integration) under one emulator boot, in one vitest pass per package.
- New `pnpm test:unit` skips the emulator for a fast inner loop.
- `pnpm app:test` (mobile jest) stays separate — different runner, no Firebase, no value in folding in.
- Transient emulator flakiness has a retry knob (`VITEST_RETRY_COUNT`, default `1`).
- Service-level integration tests against a real Firestore become a first-class category (under `packages/shared/test/integration/`) with a documented pattern, even if we only seed the harness in this spec and add tests lazily.

## Non-Goals

- Mass-renaming existing test files. Decided already — keep `packages/shared/test/e2e/*Rules.test.ts` as-is.
- Deleting the granular escape-hatch scripts (`pnpm test:rules`, `pnpm test:integration`, `pnpm test:functions`). They stay as targeted one-off runs.
- Folding mobile jest into vitest, or wiring jest to the emulator. Mobile tests stay node-pure + AsyncStorage-mocked.
- Backfilling service integration tests for every existing service. The harness arrives; tests can land lazily.
- Maestro / detox / UI E2E. Out of scope.

## Design

### Layered command surface (after this change)

| Command | Boots emulator? | What runs |
|---|---|---|
| `pnpm test:unit` | ❌ | shared vitest (unit-only includes) + functions unit + mobile jest. Fast inner loop. |
| `pnpm test` | ✅ once | shared vitest (ALL includes — unit + integration + e2e) + functions vitest (unit + integration) + mobile jest (skips emulator). All node-side tests in one command. |
| `pnpm test:rules` | ✅ once | shared vitest filtered to `test/e2e/`. Escape hatch. |
| `pnpm test:integration` | ✅ once | shared vitest filtered to `test/integration/`. Escape hatch. |
| `pnpm test:functions` | ✅ once | functions vitest integration. Escape hatch. |
| `pnpm check` | ✅ once | typecheck + `pnpm test` + build. |

The escape hatches all funnel through the same emulator orchestrator — but each starts its own emulator. The new `pnpm test` boots the emulator ONCE and runs every node-side test under it (no triple-restart).

### Orchestrator changes

`scripts/run-tests-with-emulators.mjs` gains the ability to run **multiple test commands under a single emulator session**:

```bash
node scripts/run-tests-with-emulators.mjs \
  --label shared "pnpm --filter @cultuvilla/shared test:all" \
  --label functions "pnpm --prefix functions run test:all"
```

Pseudocode contract (real shape may differ, this is the spec):
- `--label <name> <cmd>` may be repeated; each command runs sequentially under the live emulator.
- Each command's stdout/stderr streams unchanged.
- Exit code = first non-zero among the children (after all run); emulator shuts down cleanly on any signal.
- Single-command invocation (current behaviour) keeps working unchanged for backwards compatibility.

The orchestrator also gains:

- **Vitest retry env propagation:** orchestrator sets `VITEST_RETRY_COUNT` if the env passed in (default left untouched). Each vitest config reads `process.env.VITEST_RETRY_COUNT` and passes `--retry N` if set. Default for the unified `pnpm test`: `1` retry. Per-suite override possible.
- **Functions build step:** before launching the emulator, if `functions/` has TS sources and `lib/` is missing/stale, run `pnpm functions:build`. Ordago does this and prevents "functions emulator can't find lib/index.js" failures.
- **Java check:** quick `java -version` probe with a clear error if missing — Firestore emulator needs JDK.

### New vitest configs / config consolidation

In `packages/shared/`:

- `vitest.config.ts` — extended to add a new option-set selection mechanism. Specifically, introduce a `vitest.config.all.ts` that includes BOTH unit + integration + e2e patterns under a single emulator, with `fileParallelism: false, maxConcurrency: 1` matching the existing e2e config (the emulator is shared state). Existing `vitest.config.integration.ts` and `vitest.config.e2e.ts` stay as escape-hatch configs.
- Add a `test:all` script in `packages/shared/package.json` that runs `vitest --config vitest.config.all.ts`.

In `functions/`:

- Add a comparable `test:all` script that runs both unit and integration vitest in a single invocation (currently `npm test` is unit-only and `npm run test:integration` is separate).

### Vitest retry wiring

Add to each of `packages/shared/vitest.config*.ts` (and the functions equivalent):

```ts
import { defineConfig } from 'vitest/config';

const RETRY = Number.parseInt(process.env.VITEST_RETRY_COUNT ?? '0', 10);

export default defineConfig({
  test: {
    // ...existing fields...
    retry: Number.isFinite(RETRY) && RETRY > 0 ? RETRY : 0,
  },
});
```

Default `RETRY=0` for the inner-loop unit configs (fast, deterministic, no value in retrying). Default `RETRY=1` for emulator configs (orchestrator sets `VITEST_RETRY_COUNT=1` in the env passed to its child processes when the user doesn't override).

### Service-level integration test harness

New directory pattern: `packages/shared/test/integration/<service>Integration.test.ts`.

- Loads via `vitest.config.integration.ts` (existing).
- Uses the same Firebase emulator the rules tests use, but with the **admin SDK** (`firebase-admin/firestore`) so rules don't gate writes — exercising service behaviour, not rules.
- Pattern (one worked example shipped in this change to bootstrap):

  ```ts
  // packages/shared/test/integration/villageMemberServiceIntegration.test.ts
  import { describe, it, expect, beforeAll, afterEach } from 'vitest';
  import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
  import { getFirestore } from 'firebase-admin/firestore';
  import { getUserMemberships } from '@cultuvilla/shared/services/villageMemberService';

  let app: App;
  beforeAll(() => {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
    app = initializeApp({ projectId: process.env.TEST_PROJECT_ID ?? 'cultuvilla-test' });
  });

  afterEach(async () => {
    // wipe emulator data between tests via the REST endpoint
    await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${process.env.TEST_PROJECT_ID ?? 'cultuvilla-test'}/databases/(default)/documents`, { method: 'DELETE' });
  });

  it('returns memberships across municipalities', async () => {
    const db = getFirestore(app);
    await db.doc('municipalities/m1/members/alice').set({ userId: 'alice', role: 'member', joinedAt: new Date() });
    await db.doc('municipalities/m2/members/alice').set({ userId: 'alice', role: 'admin', joinedAt: new Date() });
    // service uses the JS SDK which is configured via the same FIRESTORE_EMULATOR_HOST env
    const memberships = await getUserMemberships('alice');
    expect(memberships).toHaveLength(2);
  });
  ```

  The exact init shape needs to be confirmed against `packages/shared/src/firebase.ts` during implementation — the JS SDK init must pick up `FIRESTORE_EMULATOR_HOST` automatically (it does in firebase 10+).

The seed example uses villageMemberService precisely because it was the surface of the bug we just fixed — having an integration test for it now closes the door on regressions where the service is rewritten and stops returning the right docs.

## Files Created / Modified

- `scripts/run-tests-with-emulators.mjs` — **modify**. Add `--label <name> <cmd>` multi-command support, JDK probe, functions-build pre-step, `VITEST_RETRY_COUNT` defaulting.
- `package.json` — **modify**. Rewrite `test` to call the orchestrator with multiple `--label` chunks. Add `test:unit`. Keep `test:rules`, `test:integration`, `test:functions` working (one-shot escape hatches).
- `packages/shared/package.json` — **modify**. Add `test:all` script.
- `packages/shared/vitest.config.all.ts` — **new**. Includes unit + integration + e2e patterns; `fileParallelism: false, maxConcurrency: 1`; reads `VITEST_RETRY_COUNT`.
- `packages/shared/vitest.config.integration.ts`, `vitest.config.e2e.ts`, `vitest.config.ts` — **modify**. Add `retry` from `VITEST_RETRY_COUNT`.
- `functions/package.json` — **modify**. Add `test:all` script.
- `functions/vitest.config*.ts` — **modify**. Add `retry` from `VITEST_RETRY_COUNT`.
- `packages/shared/test/integration/villageMemberServiceIntegration.test.ts` — **new**. Seed integration-test example wired up to the new `test:all` config.
- `packages/shared/test/integration/README.md` — **new**. One-page pattern doc: when to write an integration test (catches "wrong query shape" bugs that pure unit tests miss), how to seed via admin SDK, how to wipe between tests via the emulator REST endpoint.
- `docs/superpowers/specs/2026-05-29-unify-test-pipeline-design.md` — this spec.
- `docs/superpowers/plans/2026-05-29-unify-test-pipeline.md` — written by `writing-plans` next.
- `.github/workflows/*.yml` — **possibly modify** if CI currently calls the specific sub-scripts. To be checked during implementation.

## Testing

- `pnpm test:unit` runs cleanly in under ~30s on a developer machine, no emulator boot.
- `pnpm test` boots emulator exactly once, runs shared (all categories) + functions, exits 0 with all suites green.
- `pnpm test:rules` still works (escape hatch) — boots its own emulator and runs only e2e tests.
- `pnpm check` runs typecheck + the new unified `pnpm test` + build — single emulator boot for the test phase.
- The new `villageMemberServiceIntegration.test.ts` passes against the emulator and demonstrates the pattern.
- Re-running with `VITEST_RETRY_COUNT=0` confirms retry knob honours the env override.

## Rollout

Single PR. The default `pnpm test` semantics change — callers who relied on the silent-no-emulator behaviour will notice an emulator booting. That's intended (it's the headline bug fix). Documented in the PR description and the (existing) CONTRIBUTING / agents notes.

CI changes are scoped to whichever workflow currently invokes `pnpm test`, `pnpm test:emulators`, or `pnpm check`. To be reviewed in the plan.

## Risks & Mitigations

- **Risk:** Booting the emulator in CI for every `pnpm test` run adds ~10s to fast PR checks. **Mitigation:** still under a minute; CI caches `~/.cache/firebase/emulators` so download is one-time; the per-emulator-restart cost we eliminate is larger (currently 3 boots in `test:emulators`).
- **Risk:** Vitest retry can mask genuine flakes by making them green-on-retry. **Mitigation:** retry defaults to `1` (one extra attempt) and only on emulator-backed configs; unit tests retry 0; CI surface lists retried tests so flakes are visible, not silent.
- **Risk:** The orchestrator's multi-command mode could deadlock if a child hangs. **Mitigation:** ports-ready handshake before spawning each child; SIGINT propagation; per-command timeout via env override (`TEST_TIMEOUT_MS`, default 600s).
- **Risk:** Service integration tests against the same emulator as rules tests share state and can flake when run in parallel. **Mitigation:** `fileParallelism: false, maxConcurrency: 1` in the new config (same as today's e2e). The orchestrator runs commands serially under the same emulator.
- **Risk:** Admin SDK init in service integration tests interferes with the JS SDK that services use internally. **Mitigation:** confirmed pattern in ordago-apps; both SDKs target `FIRESTORE_EMULATOR_HOST` independently and don't conflict. To be verified empirically in implementation.

## Open Questions

None blocking. Specific CI workflow names to touch, and whether `functions/` already has a usable vitest setup or needs one, will be pinned in the implementation plan.
