# Testing enhancement

**Goal:** Raise the ceiling of Cultuvilla's testing from mostly-unit toward **high-level integration and end-to-end flows** — exercising real navigation, real Firebase behaviour, and cross-layer contracts — using the sibling `ordago-apps` repo (same stack: Firebase + Expo + shared package + Cloud Functions) as a proven reference.

## Status

- **Updated:** 2026-07-03
- **Stage:** Stage 1 (foundations) + Stage 2 (emulator-level integration) both authored on `feat-testing-foundations`.
- **Branch:** `feat-testing-foundations` (worktree `.claude/worktrees/testing-foundations/`) — PR #39 to `develop`.
- **Done:** Stage 1 — coverage (B5), i18n key-parity (C7), emulator/rules harness + 18-file migration (C6). Stage 2 — A4 runnable builder↔rules shape-contract invariants (12 tests); A2 `organizations` approve/reject update rules e2e test (filled a real gap); A3 `requestJoinOrganization` handler boundary test (filled a real gap).
- **Next:** Stage 3 checkpoint — E2E substrate (D5 fixtures + D2 fixture-login seam in `AuthContext` + bypass-leak gate + Playwright) needs its own `ready/` plan and product/security decisions before coding. Stopped here deliberately for discussion.
- **Blockers:** Emulator-backed suites (e2e rules / functions handlers) can't be run by the agent per AGENTS.md "Never start dev servers". A4 is fully runnable and green; the C6 migration, A2, and A3 are **typecheck-validated** and must be **emulator-verified by CI / the user** (`pnpm test:rules`, `pnpm test:functions`) before merge.
- **Handoff:** All work is in the worktree; base checkout stays on `develop`. Coverage is **report-only** (D4) — no CI gate. Stage 2 scope was narrowed from the plan after scoping revealed the callable boundary is already well-tested and two of the three solicitudes writes are server-only (see the note below the Tasks) — so A2/A3 fill the two genuine gaps rather than duplicating coverage.

## Context

Cultuvilla and ordago-apps are the same architectural shape — Firebase-backed pnpm monorepos with an Expo RN app, a `@shared` package, and Cloud Functions — so ordago's testing patterns transfer almost 1:1. The difference is maturity:

| | ordago-apps | cultuvilla |
|---|---|---|
| Test files | ~376 | ~182 |
| Test LOC | ~70,000 | ~17,000 |
| Coverage | v8 everywhere, diff-coverage in CI (report-only, ratchet) | **none** |
| Security-rules tests | first-class, shared `rulesTestEnv` + `asAdmin`/`asUser` helpers | 17 files, but setup boilerplate copy-pasted per file |
| Data-integrity invariants | `test/validation/` (dangling refs, orphan cardinality) | **none** |
| Conformance/drift audit vs real data | `test/audit/` (run on demand) | a `check:dev-conformance` **script**, not test-shaped |
| Device E2E | ~14 Maestro flows + Android-emulator CI job | **none** |
| i18n key-parity | (n/a) | **zero tests** in `packages/i18n` |

Our current center of gravity is `packages/shared` unit tests (models + services + rules) — genuinely decent. The clear **gaps are all at the high level**: nothing exercises a real mobile navigation flow, deep link, or Firebase-backed screen end-to-end; rules and the services that issue the same writes are tested independently with no contract tying them together; and there's no visibility (coverage) into what's actually untested.

**User priority (2026-07-03):** aim for **integration / high-level tests**, not more unit tests. This plan is ordered accordingly — the device-E2E and cross-layer-integration work is the headline; the unit-level infrastructure (coverage, i18n parity, harness extraction) is supporting scaffolding that makes the high-level work cheaper and more trustworthy.

## Design / approach

Three workstreams, roughly in dependency order. The high-level testing (A) is the goal; B and C exist to make A reliable and observable.

### A. High-level & integration testing (the headline)

1. **Dual-track device/browser E2E, on a shared substrate, trending native.** The app is on a deliberate trajectory from web toward first-class native (see Decisions D1), so E2E is designed as **two drivers over one shared substrate**:
   - **Near-term primary — Playwright over the Expo web export.** The web build already ships and is where users are today; the same React tree runs in a browser, so Playwright covers the bulk of flows cheaply and per-PR on GitHub-hosted runners.
   - **Strategic, growing — Maestro on Android.** A `.maestro/flows/` tree (`smoke.yaml`, `ci/`, `regressions/`, reusable `subflows/`) driving a real APK on an emulator, matching ordago. We already have the `drive-android-avd` skill and WSL2/adb plumbing. This suite grows as native becomes first-class and eventually becomes the primary surface. **Maestro over Detox** — YAML flows, low maintenance, no native test-build harness, matches the reference repo.
   - **The shared substrate is what makes flows portable:** the seed fixtures (D5), the fixture-login seam (D2), and the *Firebase-state assertions* are defined once and consumed by both drivers; only the UI-driving script differs. So a flow authored for web ports to native as coverage shifts, and the driver choice is the only thing that changes.

   Candidate first flows (author on web, port to native):
   - Auth → land on village feed → open an event → sign self up → see registration reflected.
   - Organizer request → (admin) approval → village activated.
   - Create org (pending) → village-admin approval → org appears.
   - Deep-link into an event / village and render (native-only concern — Maestro).

2. **Cross-layer contract / integration tests (emulator).** Today `firestore.rules` e2e tests and the shared services that issue the *same* writes are tested independently. Add integration tests that drive a **real service-layer call against the emulator** (rules enabled) and assert the write both succeeds through the service *and* is what the rule intended — so a rule tightening that breaks a service path fails a test. This is the highest-value "integration" tier below full device E2E and reuses infrastructure we already have.

3. **Cloud Function flow tests at the boundary.** We have handler tests asserting Firestore-observable effects; extend toward callable **auth/permission error paths at the function boundary** (currently partly covered in `shared/services/callableErrors.test.ts` rather than against the function itself) — e.g. `respondToOrganizerRequest`, `approveOrganization`, `respondToJoinRequest` invoked as non-admin must reject.

4. **Data-integrity invariant tests** (ordago's `test/validation/`). Declarative invariants run over seeded/snapshot data — no dangling `municipalityId`, no org member without a user, registration counts consistent, and **denormalized read-models agree with their source** (directly serves our denormalized-read-model architecture). Catches referential bugs unit tests structurally can't.

### B. Observability — coverage (supporting)

5. **Turn on coverage.** `@vitest/coverage-v8` for shared + functions, Jest `--coverage` for mobile. Adopt ordago's **ratchet philosophy**: report-only first, then gate on **patch/diff coverage only** (never absolute total) via `diff-cover` on PRs. ordago's `scripts/merge-coverage.js` + `coverage.yml` are directly liftable. Purpose here is to *see where the high-level tests still leave holes*, not to chase a number.

### C. Harness & hygiene (supporting)

6. **Extract the emulator/rules harness.** Our ~21 emulator-backed shared tests re-inline `readFileSync(firestore.rules)` + env setup, and `test/README.md` references a `helpers/` dir that no longer exists. Port ordago's `rulesTestEnv.ts` + `roles.ts` (`asAdmin`/`asUser`) — kills boilerplate, makes new integration/rules tests trivial to write, fixes stale docs. **Prerequisite for A2** (writing many new emulator tests without this is painful).

7. **i18n key-parity tests.** `packages/i18n` has zero tests. Tiny vitest suite: every key present across locales, no orphans, and every `useT('...')` key used in the apps exists in the catalog. Cheap, prevents a class of "missing string" runtime crashes.

8. **CI cost engineering.** Add `dorny/paths-filter` so UI-only PRs skip the 25-min emulator job; run device E2E only on release PRs (`develop → beta`) as ordago does; keep `VITEST_RETRY_COUNT=1` for gRPC flakiness. Keeps the new high-level jobs from slowing every PR.

### Suggested sequencing

`C6 (emulator/rules harness)` + `B5 (coverage)` land first as enablers → then `A2/A3/A4` (emulator-level integration + contract + invariants, cheap once the harness exists) → then the **shared E2E substrate** (D5 fixtures + D2 fixture-login + the bypass-leak gate) → then `A1` **web Playwright** flows (near-term primary) → then **Maestro native** flows growing over time as native becomes first-class. Because native E2E is the largest push and is release-gated (D3), it likely gets its own `ready/` plan when scoped. `C7` (i18n parity) and `C8` (`paths-filter` CI) are independent quick wins that can slot in anytime.

## Decisions (resolved 2026-07-03)

All six original open questions are resolved. Each is stated as a decision, the reasoning, and what it binds so a future reader knows why — not just what.

- **D1 — E2E strategy: dual-track over a shared substrate, trending native.** The app is on a deliberate long-term move from web toward first-class native, so Maestro (native) grows in importance over time. Therefore: **Playwright over the Expo web export is the near-term primary** (that's the current user surface, and it's cheap/deterministic/GitHub-hosted-friendly); **Maestro on Android is the strategic investment** that expands as native becomes first-class and eventually becomes primary. The two drivers share one substrate (fixtures + fixture-login + Firebase-state assertions) so flows port between them. *Binds:* no test infrastructure may assume a single UI target; flows are authored against the shared substrate, not baked into one driver.

- **D2 — Fixture login: emulator-backed test seam in `AuthContext`, guarded by a bypass-leak gate adopted immediately.** The single sanctioned auth-boundary file (`apps/mobile/lib/auth/AuthContext.tsx`) gains a test-only sign-in path that mints a session via the **Firebase Auth emulator** (custom token / emulator sign-in), never real Google OAuth. It is inert unless an explicit test env flag is set *and* the Firebase config points at the emulator. Adopt ordago's **grep-based CI "bypass-leak" gate now — before any device E2E ships** — so the seam can never escape into a beta/prod build. *Binds:* the seam and the gate land in the same change; the gate is a required status check.

- **D3 — CI runners: stay GitHub-hosted (`ubuntu-latest`); cost-gate the heavy jobs by trigger.** No self-hosted infra. Consequence: Playwright web E2E runs **per-PR** (fast, cheap). Native Maestro via `reactivecircus/android-emulator-runner` runs **only on release PRs (`develop → beta`) and pushes to `main`**, not every PR — this is how we keep GitHub minutes sane without ordago's self-hosted `powerserver`. Add `dorny/paths-filter` (workstream C8) so UI-only PRs skip the emulator suite. *Binds:* per-PR test time must stay bounded; anything slow is release-gated.

- **D4 — Coverage: report-only first, then gate on patch/diff coverage only, never absolute total.** `@vitest/coverage-v8` (shared + functions) + Jest v8 (mobile), per-package LCOV merged, `diff-cover` on PRs. When we gate, target ~80% on the patch. *Binds:* no one-time legacy-coverage backfill is ever required; quality ratchets up on new code only. Rationale: a total-coverage gate on a 17k-LOC baseline would be a demoralizing wall; patch coverage makes every PR leave the codebase better.

- **D5 — E2E seed data: dedicated deterministic minimal fixtures against the emulator, never a real project.** Purpose-built small, stable, assertion-friendly fixtures — *not* the `demo_1` showcase dataset — built by **reusing the production model builders** (ordago's factory-reuses-builders principle, so fixtures can't drift from schema) via the existing `scripts/seed/` machinery. All E2E (web and native) runs against the **emulator** (Android emulator reaches it via `adb reverse` / `10.0.2.2`); no flow ever touches dev/beta/prod. *Binds:* this fixture set is the shared substrate of D1; it is versioned with the flows that assert against it.

- **D6 — Contract tests (A2): seed with the solicitudes trio, but build the harness general.** First coverage targets `organizerRequests` / `organizations` (pending) / `organizationJoinRequests` — the densest rule↔service↔function interplay and highest security stakes. The harness itself is **parametrized over (collection, actor role, expected rule outcome)** so extending to every sensitive collection is additive, not a rewrite. *Binds:* the contract-test harness is written as a general table-driven fixture from day one, even though it launches with three collections.

## File Structure

Foundations chunk (this branch). Later workstreams (A1 Playwright/Maestro, A2–A4) get their own file-structure entries when scoped.

**Create**
- `packages/shared/test/helpers/rulesTestEnv.ts` — `useRulesTestEnv()` (registers `beforeAll`/`beforeEach`/`afterAll`, returns an env getter) + `createRulesTestEnv()`. Reads the live `firestore.rules`.
- `packages/shared/test/helpers/roles.ts` — `asUser`/`asAnon`/`asAdmin` context helpers + `seed()` (a `withSecurityRulesDisabled` wrapper) + `seedAdmin()`.
- `packages/i18n/test/keyParity.test.ts` — locale key-parity + no-orphans invariants over the message catalog.
- `packages/i18n/test/usedKeys.test.ts` — every `useT('...')` / dotted key referenced in `apps/mobile` exists in the catalog.
- `packages/i18n/vitest.config.ts` — unit config for the new suite.

**Modify**
- `packages/shared/vitest.config.ts`, `vitest.config.integration.ts`, `vitest.config.e2e.ts`, `vitest.config.all.ts` — add report-only `coverage` (v8).
- `packages/shared/test/e2e/*.test.ts` (16) + `packages/shared/test/integration/*.test.ts` (4) — migrate to the extracted harness.
- `packages/shared/test/README.md` — fix the stale `helpers/` references to match reality.
- `functions/vitest.config.mjs` (+ `.integration`/`.all`) — add report-only `coverage` (v8).
- `apps/mobile/jest.config.js` — coverage already declared inert; add a `test:coverage` script.
- `packages/i18n/package.json` — add `vitest` + `@vitest/coverage-v8` devDeps and `test`/`test:coverage` scripts.
- `packages/shared/package.json`, `functions/package.json` — add `@vitest/coverage-v8` devDep + `test:coverage` scripts.
- root `package.json` — add `i18n:test`; fold i18n into `test:unit`; add a `test:coverage` aggregate.
- `CHANGELOG.md` — note under `[Unreleased]`.

## Tasks

### Stage 1 — Foundations (done, on `feat-testing-foundations`)
- [x] **C6** `helpers/rulesTestEnv.ts` + `helpers/roles.ts`; migrated 18/20 e2e/integration tests (storageRules + emailLinkAuth don't fit); fixed `test/README.md`.
- [x] **C7** i18n key-parity + used-keys suites; `vitest` wired into `packages/i18n`; `i18n:test` in root + `test:unit`.
- [x] **B5** Report-only v8 coverage in shared + functions + mobile; `test:coverage` scripts; provider pinned once at root.
- [x] Verify (`pnpm typecheck`/`lint`, i18n tests, unit coverage); CHANGELOG; PR #39 to `develop`.
- [ ] **User step:** `pnpm test:rules` + `pnpm test:integration` to emulator-verify the migrated harness (CI's emulator-tests job also covers this).

### Stage 2 — Emulator-level integration (done, same branch)
- [x] **A4** Data-integrity invariant tests (`test/validation/rulesShapeContract.test.ts`) — 12 tests, fully runnable (no emulator). Locks each of 6 create-gated builders to its `firestore.rules` `isValid*Create` key set + review-lifecycle defaults.
- [x] **A2** `organizations` approve/reject **update** rules e2e test (`test/e2e/organizationUpdateRules.test.ts`) — filled a genuine gap. (emulator-verified by CI/user)
- [x] **A3** `requestJoinOrganization` handler boundary test (`functions/src/__tests__/handlers/`) — filled a genuine gap. (emulator-verified by CI/user)

> **Scoping note (why A2/A3 are narrow):** the callable boundary was already well-tested (`respondToOrganizerRequest`, `respondToJoinRequest`, `requestOrganizeVillage`, `requestAyuntamiento` all have unauthenticated/permission-denied handler tests), and two of the three solicitudes writes are **server-only** by rule (`allow create,update: if false`) — so there's little client-write surface to contract-test. The high-value runnable contract turned out to be the builder↔rules **shape** agreement (A4), not emulator round-trips. A2/A3 fill the two real gaps rather than duplicating coverage; a broader table-driven rules harness (D6) is deferred until a collection actually needs it.

### Stage 3 — E2E substrate + web flows (own `ready/` plan when scoped) — **checkpoint before coding**
- [ ] **D5** Deterministic emulator fixtures from prod model builders.
- [ ] **D2** Fixture-login seam in `AuthContext` + grep-based bypass-leak CI gate (ship together). *Product/security code — needs a design pass.*
- [ ] **A1 (web)** Playwright flows over the web export; per-PR CI job (D3). *Needs a running web export + browsers the agent can't start.*

### Stage 4 — Native E2E (grows over time — D1)
- [ ] **A1 (native)** Maestro flows on Android; release-gated CI job (D3). Likely its own plan.
- [ ] **C8** `dorny/paths-filter` CI cost-gating.
- [ ] **B5 (gate)** Flip coverage from report-only to a patch-coverage gate via `diff-cover` (D4).

This is workstream-A-driven; B and C are the scaffolding that makes A affordable and honest. Stages 1–2 are on `feat-testing-foundations`; Stage 3 is the next checkpoint.
