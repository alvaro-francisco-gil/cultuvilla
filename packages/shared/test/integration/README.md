# Service integration tests

Tests that exercise a service function (from `packages/shared/src/services/`) against the **real Firebase emulator** rather than mocks.

## When to write one

Write an integration test for a service function when **the shape of the query matters**: a wrong collection name, missing `where` clause, wrong field name, or stale denormalized read model. Pure unit tests with mocked Firestore can't catch these — the mock always returns whatever you tell it to.

Specifically, write one when:

- The service issues a `collectionGroup(...)` query — the path through the rule engine is non-trivial; a real Firestore catches typos in the CG name.
- The service uses `where(...)` filters whose field name is also referenced in `firestore.rules` — drift between the two surfaces as a permission-denied in prod.
- The service depends on a composite index — a missing index returns `FAILED_PRECONDITION` from the emulator.

If the function is a pure helper (no Firestore call), use a regular unit test under `test/services/`.

## How to write one

1. File lives at `packages/shared/test/integration/<service>Integration.test.ts` (or follows the existing roundtrip naming for read-then-write flows).
2. Picked up automatically by `vitest.config.integration.ts` and `vitest.config.all.ts`.
3. Uses `@firebase/rules-unit-testing` with `env.withSecurityRulesDisabled(...)` to seed — same pattern as `villageRoundtrip.test.ts`. Don't add `firebase-admin` as a dep; the rules-unit-testing library already gives us a rules-bypass channel.
4. If the test calls a service function (which uses the JS SDK via `getDb()`), spy on `getDb` using `vi.spyOn(firebaseModule, 'getDb').mockReturnValue(...)` and return `env.authenticatedContext(uid).firestore()` (cast as `Firestore`). This satisfies the collectionGroup rule (which requires auth) without initialising the full Firebase JS SDK separately. Use `vi.restoreAllMocks()` after the test.
5. Use relative imports (`../../src/services/...`) rather than `@cultuvilla/shared/...` — `vitest.config.integration.ts` does not configure the path alias.
6. `beforeEach` calls `env.clearFirestore()` for a clean slate.

## How to run

```bash
pnpm test:integration   # just this dir, one emulator boot
pnpm test               # everything (unit + integration + e2e + functions) under one emulator boot
```

## Examples

- `villageRoundtrip.test.ts` — write-then-read roundtrip via the JS SDK directly (no service layer).
- `villageMemberServiceIntegration.test.ts` — service-shape verification for `getUserMemberships` collection-group query.
