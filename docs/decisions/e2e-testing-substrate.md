# E2E testing substrate (web Playwright now, native Maestro later)

## Context

Unit and emulator *rules* tests existed, but nothing exercised a real navigation
flow against real Firebase behaviour. Cultuvilla ships a web build (`expo export
--platform web` → Firebase Hosting) that runs the same React tree as native via
react-native-web, so the same flows can be driven on web now and on device later.
A running-app E2E needs three things unit tests don't: a client emulator-connect,
emulator-mode seeding, and a test-login that works in a production-like export
build (where `__DEV__` is false).

## Decision

- **One portable substrate, two drivers.** The reusable layer is the seeded
  dataset + `apps/mobile/e2e/lib/fixtures.ts` + `emulatorState.ts` (Firestore
  emulator reads over REST, pure Node). Flows assert on **Firestore emulator
  state, not DOM** — that is the stable backbone; UI-driving (`testID`) is the
  fragile half. Only the *driver* changes between web (Playwright) and native
  (Maestro); `fixtureLogin.ts` (`window.__cultuvillaE2E`) is the one web-specific
  piece.
- **`emulatorState` reads bypass rules with `Authorization: Bearer owner`.** These
  reads assert backend truth, not security rules; the emulator enforces rules on
  its REST API, so an unauthenticated read of a rule-protected collection
  (`organizerRequests`, members, …) returns empty and silently fails the
  assertion. The owner token is the emulator's rules-bypass.
- **Fixture-login security model (the crux).** A test-login is a deliberate auth
  bypass; the invariant is that it can never activate in a build a real user could
  load. Three independent guards, so no single mistake leaks:
  1. **One flag gates everything** — `USE_FIREBASE_EMULATOR` (→ `app.config.ts`
     `extra.useEmulator`) gates *both* the emulator-connect seam *and* the
     fixture-login. Set **only** in the E2E CI job; never in `deploy-*.yml` or
     `.env`.
  2. **Fail-closed by physics** — fixture-login and emulator-connect share the
     flag, so a fixture session can only mint when pointed at `127.0.0.1`
     emulators. A deployed build (real hosts, no emulator) can't complete the flow
     even if the flag leaked. Hardened further with a runtime loopback-host
     assertion before the seam fires, and a positive "flag is unset" assertion in
     the deploy workflows.
  3. **Grep gate** — `scripts/check-no-test-login-leak.mjs` fails CI if the flag,
     the fixture-login symbols, or any `connect*Emulator` appear outside a short
     allowlist (the seam files). Wired into `pnpm check`.
- **Fixtures built through the production `build*Data` model builders** so they
  can't drift from schema. Seeded by a standalone `scripts/seed/e2e.mjs` against a
  dedicated emulator project `cultuvilla-test` (never the real `villa-events`);
  `scripts/seed/lib/context.mjs` relaxes its `villa-events`-only + credentials
  guards when `FIRESTORE_EMULATOR_HOST` is set.
- **Native Maestro is groundwork only.** One anonymous deep-link smoke
  (`apps/mobile/e2e/native/`), manual/opt-in, **not** in CI (no AVD in CI). On an
  AVD the emulator-connect host is overridden to `10.0.2.2`.

## Rejected alternatives

- **Gate the E2E login on `__DEV__`** — `__DEV__` is false in the `expo export`
  bundle Playwright drives, so it wouldn't fire. Keyed off `USE_FIREBASE_EMULATOR`
  instead (independent of `__DEV__`; local dev auto-login keeps its own gating).
- **`signInWithCustomToken` / a broader auth surface** — rejected to keep the
  bypass to a single `signInWithEmailAndPassword` primitive, so the grep gate has
  one small surface to guard.
- **Thread a new `DATASET` through the six domain seeders** — rejected for a
  self-contained `seed:e2e`, isolated from the dev-seed path while keeping the
  built-from-prod-builders property.
- **Detox for native** — rejected in favour of Maestro (YAML flows).

## What this binds

- A new web flow drives the UI by `testID` and makes its **strong assertion
  against Firestore emulator state via `emulatorState`**, reusing the existing
  `fixtureLogin` seam. Don't broaden the auth surface or the bypass-leak allowlist.
- All fixtures go through the `build*Data` builders.
- `USE_FIREBASE_EMULATOR` must never appear in deploy workflows or `.env`; the grep
  gate enforces it.
- The `web-e2e` CI job is currently gated to the **beta release path** (PRs
  targeting `beta` / pushes to `beta`), not day-to-day `develop` PRs — expensive
  emulator+Playwright boot, run at the release-candidate gate. `develop` PRs get
  the fast `typecheck-and-test` job.

## Revisit when

- Interactive native flows are needed → design the native fixture-login mechanism
  (deep-link login intent or a testID dev button) and wire a full Maestro suite —
  the deferred **Stage 4**.
- CI cost or coverage tightening is wanted → the two Stage-4 leftovers from the
  parent testing-enhancement plan: flip coverage from report-only to patch-coverage
  (`diff-cover`, D4) and add `dorny/paths-filter` cost-gating (C8).
