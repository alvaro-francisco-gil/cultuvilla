# E2E testing substrate + web flows

**Goal:** Stand up the shared end-to-end substrate (emulator-connect seam, deterministic emulator fixtures, a fail-closed fixture-login) and the first Playwright flows over the web export, so real user journeys are tested against real Firebase behaviour on every PR.

This is **Stage 3** of [testing-enhancement.md](testing-enhancement.md), split into its own plan per that plan's note ("own `ready/` plan when scoped"). It realises decisions **D1** (dual-track, shared substrate), **D2** (fixture-login + bypass-leak gate), **D3** (GitHub-hosted, web E2E per-PR), and **D5** (deterministic emulator fixtures). Native Maestro (Stage 4) stays out of scope here.

## Status

- **Updated:** 2026-07-04
- **Stage:** 3a + 3b + 3c all **authored** on `feat/e2e-substrate` (commits 3a/3b/3c). Awaiting the CI `web-e2e` job as the verification gate.
- **Branch:** `feat/e2e-substrate` (worktree `.claude/worktrees/e2e-substrate/`) — one PR to `develop`, scoped as 3a/3b/3c commits.
- **Done:** 3a substrate (emulator-connect seam, flag, seed emulator mode + standalone `pnpm seed:e2e`, bypass-leak gate + unit test); 3b fixture-login seam (+ loopback assertion) + Playwright config/lib + two flows (sign-up, deep-link smoke); 3c `web-e2e` CI job + deploy "flag unset" guard + CHANGELOG. Parent Stages 1–2 merged (PR #39).
- **Next:** Open the PR; let the CI `web-e2e` job run. **Likely needs a round or two of selector/setup iteration** since the flows were authored without running the app — the deterministic Firebase-state assertions are the stable backbone; the UI-driving selectors are the fragile part to tune from CI artifacts. Then add the deferred organizer-request→approval flow.
- **Blockers:** none. Security model **signed off 2026-07-04** (Option 1C — see parent plan Handoff). Agent cannot run emulators/Playwright (AGENTS.md); the CI `web-e2e` job is the verification gate.
- **Handoff:**
  - **Ships as ONE PR**, 3a/3b/3c as separate commits (not three PRs) — pre-users, deployed artifact is identical regardless of PR count; the fail-closed design is the guardrail, not the PR boundary.
  - **Security hardening beyond the base plan (Option 1C):** add (a) a runtime assertion that the auth host is a loopback address before the fixture-login fires, and (b) a positive "`USE_FIREBASE_EMULATOR` is unset" assertion in the deploy workflows — belt-and-suspenders on top of the single-flag + fail-closed + grep-gate design below.
  - **Emulator project id:** dedicated `cultuvilla-test` (already `run-tests-with-emulators.mjs`'s default `TEST_PROJECT_ID`), never `villa-events`.
  - **e2e seeder:** implemented as a **standalone `scripts/seed/e2e.mjs`** (reuses the production model builders + `scripts/seed/lib` emulator-mode context) rather than threading a new `DATASET` through all six domain seeders — self-contained and isolated from the dev-seed path, while keeping the D5 "fixtures built from prod builders, can't drift" property.

## Context

Cultuvilla ships a web build (`expo export --platform web` → `apps/mobile/dist`, deployed to Firebase Hosting at villa-events.web.app) that runs the same React tree as native via react-native-web. Per D1, web Playwright is the near-term primary E2E driver; native Maestro grows later. Nothing today exercises a real navigation flow against Firebase — only unit/component tests and emulator *rules* tests exist.

The Stage-1 harness (`packages/shared/test/helpers/`) covers headless rules/integration tests, but a running-app E2E needs three things that **do not exist yet** (confirmed by a surface audit):

- **No client emulator-connect.** There is no `connectAuthEmulator`/`connectFirestoreEmulator`/… anywhere in `apps/mobile` or `packages/shared/src`; the web JS SDK needs explicit `connect*Emulator(...)` calls (it does not read `*_EMULATOR_HOST`). Only test harnesses set those env vars.
- **No emulator-mode in the seed scripts.** `scripts/seed/lib/context.mjs` hard-refuses any project ≠ `villa-events` and `process.exit(1)`s if `GOOGLE_APPLICATION_CREDENTIALS` is unset — so it can't currently seed the emulator, even though `firebase-admin` auto-routes to the emulator once `FIRESTORE_EMULATOR_HOST`/`FIREBASE_AUTH_EMULATOR_HOST` are set.
- **No test-login usable in a production-like build.** A `devAutoLogin` seam already exists in `apps/mobile/lib/auth/AuthContext.tsx` (email/password via `signInWithEmailAndPassword`, no Google OAuth), but it's gated by `__DEV__`, which is **false** in the `expo export` web bundle Playwright drives. E2E needs a seam that works in the test build yet can never fire in a deployed build.

## Security model (the crux — read first)

A fixture-login is a deliberate auth bypass. The single rule: **it must be impossible for it to activate in a build a real user could load.** The design makes that true three ways, so no single mistake is sufficient to leak:

1. **One flag gates everything.** A new build-time flag `USE_FIREBASE_EMULATOR` (surfaced through `app.config.ts` `extra.useEmulator`, mirroring how `devAutoLogin` is surfaced today) gates **both** the emulator-connect seam **and** the fixture-login. It is set **only** in the E2E CI job — never in `deploy-*.yml`, never in `.env` examples.
2. **Fail-closed by physics.** The fixture-login and emulator-connect share the flag, so a fixture session can only be minted when the app is pointed at `127.0.0.1` emulators. A deployed prod build (real Firebase hosts, no emulator reachable) cannot complete the flow even if the flag somehow leaked — it fails closed.
3. **A grep gate blocks leakage at the source.** `scripts/check-no-test-login-leak.mjs` (modelled on `scripts/check-no-raw-firestore-refs.mjs`) fails CI if `USE_FIREBASE_EMULATOR` / the fixture-login symbols / any `connect*Emulator` reference appear outside a short `ALLOWED_PATHS` allowlist (the seam files). Wired into `pnpm check` and the `ci` job. This is D2's "bypass-leak gate, adopted immediately."

The existing `__DEV__ && env==='dev'` gating on `devAutoLogin` stays as-is for local dev; the E2E path keys off `USE_FIREBASE_EMULATOR` so it's independent of `__DEV__`.

## Design / approach

### 1. Emulator-connect seam — `apps/mobile/lib/firebaseInit.ts`
Add a `connectEmulators` step in `bootstrapFirebase()` right after `initFirebase(...)`, guarded by `extra.useEmulator`. When set, call `connectAuthEmulator(getAuth(), 'http://127.0.0.1:9099')`, `connectFirestoreEmulator(getDb(), '127.0.0.1', 8080)`, `connectFunctionsEmulator(getFirebaseFunctions(), '127.0.0.1', 5001)`, `connectStorageEmulator(getFirebaseStorage(), '127.0.0.1', 9199)` (ports from `firebase.json`). Surface `useEmulator` in `app.config.ts` `extra` from `process.env.USE_FIREBASE_EMULATOR === '1'`. Host/ports overridable via env for CI flexibility.

### 2. Fixture-login seam — `apps/mobile/lib/auth/AuthContext.tsx`
Generalise the existing dev auto-login so it also activates under `extra.useEmulator` (not only `__DEV__`+dev). It keeps using `signInWithEmailAndPassword` against `getAuth()` (now the emulator). The credentials come from the seeded fixture users (§4). No new sign-in method, no Google-path change; `signInWithCustomToken` is **not** introduced (keeps the seam to one primitive). The seam remains the only test-auth entry point, so the bypass-leak gate has a single small surface to guard.

### 3. Bypass-leak gate — `scripts/check-no-test-login-leak.mjs`
Mirror `scripts/check-no-raw-firestore-refs.mjs` exactly (its `git ls-files` scope enumeration, `ALLOWED_PATHS` Set, per-line `// test-login: allowed` allowlist comment, `RULES` regex array, exit-0/1). Rules: flag `USE_FIREBASE_EMULATOR`, `useEmulator`, `connectAuthEmulator|connectFirestoreEmulator|connectFunctionsEmulator|connectStorageEmulator`, and the fixture-login credential env names anywhere outside `ALLOWED_PATHS` = { `apps/mobile/lib/firebaseInit.ts`, `apps/mobile/lib/auth/AuthContext.tsx`, `apps/mobile/app.config.ts`, the E2E scripts/config }. Wire `check:no-test-login-leak` into root `package.json` and the `ci` job in `ci.yml`.

### 4. Deterministic emulator fixtures — reuse `scripts/seed/`
Add an **emulator mode** to `scripts/seed/lib/context.mjs`: when `FIRESTORE_EMULATOR_HOST` (or an explicit `SEED_TARGET=emulator`) is set, (a) skip the `GOOGLE_APPLICATION_CREDENTIALS` hard-require, and (b) allow the emulator project id (accept `cultuvilla-test`, or run the emulator under `villa-events`). `firebase-admin` then auto-routes writes to the emulator. Add a small, stable dataset `scripts/data/seed-fixtures/e2e/` (a handful of users with known passwords, one started village, one approved org, a couple of events) built through the existing `build*Data` model builders so it can't drift from schema — this **is** the shared substrate of D1, consumed by both web Playwright now and native Maestro later. A `pnpm seed:e2e` script runs it against the emulator.

### 5. Playwright harness + the shared substrate — `apps/mobile/e2e/`
Add Playwright (`@playwright/test`) with `apps/mobile/playwright.config.ts` (baseURL = the served `dist`, chromium first). Flows live in `apps/mobile/e2e/flows/` and assert against Firebase state through a thin `apps/mobile/e2e/lib/` layer (fixture-login helper, emulator-state readers) — the **assertions and fixtures are the portable substrate**; only the driver differs when Maestro arrives (D1). First flows (author here, port to native later): auth→feed→open event→sign self up→see registration; organizer-request→admin-approval→village activated; deep-link into an event renders.

### 6. CI — extend `mobile-ci.yml` (per-PR, D3)
Add a `web-e2e` job: checkout → pnpm → Node 22 → **`actions/setup-java@v4` temurin 21** (the export job lacks Java today) → install → `pnpm shared:build` → `pnpm app:web:build` (with `USE_FIREBASE_EMULATOR=1` + dev placeholder Firebase config) → boot emulators via the existing `scripts/run-tests-with-emulators.mjs` pattern (auth/firestore/functions/storage) → `pnpm seed:e2e` → serve `apps/mobile/dist` (`npx serve` or the hosting emulator) → `pnpm --filter cultuvilla-mobile exec playwright test`. Per-PR (web E2E is cheap per D3); Playwright browsers cached. Native Maestro stays release-gated in a later plan.

## File Structure

**Create**
- `apps/mobile/e2e/playwright.config.ts` — Playwright config (baseURL, chromium, web server hook).
- `apps/mobile/e2e/lib/fixtureLogin.ts` — drive the fixture-login seam from a test.
- `apps/mobile/e2e/lib/emulatorState.ts` — read/assert Firestore emulator state (the portable substrate).
- `apps/mobile/e2e/flows/*.spec.ts` — the first web flows.
- `scripts/check-no-test-login-leak.mjs` — the bypass-leak grep gate.
- `scripts/data/seed-fixtures/e2e/fixtures.mjs` (+ minimal `images.manifest.mjs` if needed) — the deterministic dataset.
- `scripts/seed/e2e.mjs` (or a `SEED_TARGET=emulator` path in `all.mjs`) — emulator seeding entrypoint.

**Modify**
- `apps/mobile/lib/firebaseInit.ts` — emulator-connect seam.
- `apps/mobile/lib/auth/AuthContext.tsx` — activate fixture-login under `useEmulator`.
- `apps/mobile/app.config.ts` — surface `USE_FIREBASE_EMULATOR` → `extra.useEmulator`.
- `scripts/seed/lib/context.mjs` — emulator-mode admin init (relax the two guards).
- `apps/mobile/package.json` — `@playwright/test` devDep + `e2e`/`e2e:ui` scripts.
- root `package.json` — `check:no-test-login-leak`, `seed:e2e`; fold the gate into `check`.
- `.github/workflows/mobile-ci.yml` — the `web-e2e` job (+ Java setup).
- `ci.yml` — wire the bypass-leak gate into the `ci` job.
- `.gitignore` — Playwright artefacts (`playwright-report/`, `test-results/`).
- `CHANGELOG.md`, `docs/plans/ongoing/testing-enhancement.md` (mark Stage 3 in flight).

## Tasks

Legend: `[x]` authored + agent-runnable-verified · `[~]` authored, verified only by the CI `web-e2e` job (agent can't run emulators/Playwright) · `[ ]` not started.

### Stage 3a — Substrate (no product-facing behaviour change in real builds)
- [x] Emulator-connect seam in `firebaseInit.ts` + `USE_FIREBASE_EMULATOR` in `app.config.ts`.
- [~] Emulator mode in `scripts/seed/lib/context.mjs`; `e2e` fixtures + `pnpm seed:e2e` (standalone seeder, not a demo dataset — see File Structure note). Seeds a running emulator: CI-verified.
- [x] Bypass-leak gate `check-no-test-login-leak.mjs` (pure logic unit-tested) + wired into `pnpm check` / `ci.yml`.

### Stage 3b — Fixture-login + first flow
- [x] Fixture-login seam under `useEmulator` in `AuthContext.tsx` (+ runtime loopback assertion; bypass-leak allowlist entry — D2 / Option 1C).
- [~] Playwright config + `e2e/lib/` substrate + the anon→feed→login→sign-up flow. Runs against emulator + served `dist`: CI-verified.

### Stage 3c — CI + more flows
- [~] `web-e2e` job in `mobile-ci.yml` (per-PR, D3) + deploy-workflow "flag unset" assertion. Green-on-CI: pending first run.
- [~] Deep-link render smoke flow. **Organizer-request→approval flow deferred** — it drives multi-step admin UI; add as a fast-follow once the substrate is proven green in CI.
- [x] CHANGELOG; parent plan Status updated.

## Out of scope (later / separate)
- **Deferred organizer-request→approval flow + three more web flows + native Maestro groundwork** — picked up in the fast-follow [e2e-flows-and-native-groundwork.md](e2e-flows-and-native-groundwork.md).
- **Native Maestro (Stage 4)** — its own plan; reuses this substrate's fixtures + fixture-login + state assertions per D1.
- **Coverage gate flip** (report-only → patch-coverage `diff-cover`) — Stage 4 (D4).
- `dorny/paths-filter` CI cost-gating — Stage 4 (C8).

## Notes for the implementing agent
- **Resume context:** Stages 1–2 live on branch `feat-testing-foundations` (worktree `.claude/worktrees/testing-foundations/`, PR #39 → `develop`); the decision is to **keep stacking Stage 3 on that same branch**. Do all work in the worktree; the base checkout stays on `develop`. See the parent plan's Status → Handoff for the full resume state.
- **Gate before Stage 3b:** the fixture-login **security model** above (one `USE_FIREBASE_EMULATOR` flag, fail-closed, grep gate) needs explicit **user sign-off** before writing the auth-boundary change. Stage **3a** (emulator-connect seam, emulator-mode seeding, bypass-leak gate) is safe to start without it — no real-build behaviour change.
- Emulator-backed and running-app work can't be executed by the agent (AGENTS.md "never start dev servers"); Stage 3 is authored + typecheck/lint-validated, and **verified by the user / CI** (the `web-e2e` job is the real gate).
- The `mobile-web-compat` gotchas apply to any new screen paths a flow touches (`Alert.alert` no-op on web, NativeWind on `Animated.*`); flows should assert on web-visible outcomes.
- Keep the fixture-login to the single `signInWithEmailAndPassword` primitive; do not broaden the auth surface.
