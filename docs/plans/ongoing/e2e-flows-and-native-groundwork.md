# More app-driven E2E flows + native (Maestro) groundwork

**Goal:** Add four more real user-journey Playwright web flows on the existing E2E substrate, and stand up a minimal Maestro native harness (one anonymous smoke flow, out of the per-PR CI gate) that proves the app boots on a real device against the emulator — laying the groundwork for the deferred Stage 4 without paying the CI-emulator cost.

## Status

- **Updated:** 2026-07-04
- **Stage:** A1 (substrate extensions) starting.
- **Branch:** `feat/e2e-flows` (worktree `.claude/worktrees/e2e-flows/`) — one PR to `develop`.
- **Done:** plan authored + promoted to `ongoing/`.
- **Next:** extend `emulatorState.ts` readers + `fixtures.ts`/`fixtures.mjs` for the four flows.
- **Blockers:** none. Agent cannot run emulators/Playwright/AVD (AGENTS.md); CI `web-e2e` job + user-on-device are the verification gates.
- **Handoff:** web-flow selectors were authored without running the app — expect selector iteration from CI trace artifacts; the Firestore-state assertions via `emulatorState` are the stable backbone. Native smoke is manual/opt-in, verified by the user on an AVD.

This is a fast-follow to [e2e-substrate.md](e2e-substrate.md) (Stage 3). It consumes that plan's shared substrate — the portable `fixtures` + `fixtureLogin` + `emulatorState` layer — and realises the deferred web flows plus the first slice of **native Maestro (Stage 4)**, scoped down to groundwork only.

## Context

Today `apps/mobile/e2e/` has exactly two web flows (`register-to-event`, `deep-link-event`) driven by Playwright over the `expo export` web build against the Firebase emulator. The substrate was deliberately designed so **only the driver changes** between web and native: `apps/mobile/e2e/lib/fixtures.ts`, `emulatorState.ts` (REST reads, pure Node), and the seeded `scripts/data/seed-fixtures/e2e/` dataset are all portable. `fixtureLogin.ts` is the one web-specific piece (`window.__cultuvillaE2E`).

Two gaps this plan closes:
1. **Thin flow coverage.** Only sign-up + deep-link are driven end-to-end. The multi-step request/approval journeys (organizer request, org create/approve/join), event creation, and onboarding are covered only at unit/handler level.
2. **Zero native E2E, and no proof the app boots natively against the emulator.** CI runs no Android/iOS emulator. The dev-client + emulator-connect + seed + deep-link path has never been exercised on a device. Stage 4 (full Maestro suite in gated CI) is a large lift; a manual, opt-in smoke flow de-risks it cheaply.

## Design / approach

Two tracks, one substrate.

### Track A — Four more web flows (Playwright, per-PR CI)

Each new flow is one `apps/mobile/e2e/flows/*.spec.ts` following the canonical pattern of `register-to-event.spec.ts`: drive the UI via `testID`, then make the **strong assertion against Firestore emulator state** (via `emulatorState`), not just DOM visibility. All run in the existing `web-e2e` job in `mobile-ci.yml`.

| Flow | Journey | Strong assertion (Firestore) |
|---|---|---|
| `organizer-request-approval` | member requests to organize an un-activated municipality → super-admin approves → village activates | `organizerRequests/{id}.status == 'approved'`; `municipalities/{id}` community overlay active |
| `org-create-approve-join` | member creates a peña (pending) → village admin approves → second user requests to join → org admin responds | `organizations/{id}.status == 'active'`; `organizations/{id}/members/{uid}` exists; `organizationJoinRequests/{id}` resolved |
| `create-publish-event` | organizer creates an event → it lands on the public feed / village screen | new `events/{id}` with correct `municipalityId`; visible on feed |
| `onboarding-profile` | fresh user signs in → completes profile → adds a persona | new `persons/{id}` + `users/{uid}` profile fields written |

These need `emulatorState` readers for the collections above (currently only event/registration readers exist) and fixture additions (below).

### Track B — Native Maestro groundwork (manual/opt-in, NOT in per-PR CI)

- **Driver:** [Maestro](https://maestro.mobile.dev) (YAML flows), the driver named in the parent plan's Stage 4. No Detox.
- **One flow only:** `apps/mobile/e2e/native/flows/deep-link-event.yaml` — an **anonymous** deep-link-into-event render smoke, mirroring the web deep-link smoke. Anonymous by design: it needs no login, so it sidesteps the native fixture-login mechanism entirely (that gets designed in the real Stage 4 when interactive native flows are written).
- **Reuses the portable substrate:** the seeded event fixture (`fixtures.event.docId`) and, optionally, an `emulatorState` assertion run as a Node post-step. Only the driver (Maestro vs Playwright) differs.
- **Networking:** the emulator-connect seam hardcodes `127.0.0.1`; on an Android AVD that is the device, not the host. Use the seam's existing env override to point native at `10.0.2.2` (matches the `drive-android-avd` skill + the mirrored-networking gotcha).
- **Build:** a dev-client build with `USE_FIREBASE_EMULATOR=1`. The bypass-leak gate + deploy "flag unset" assertion already keep that flag out of shippable builds.
- **Runner:** a `pnpm app:e2e:native` script + a short `apps/mobile/e2e/native/README.md` documenting the boot-AVD → seed → build-dev-client → `maestro test` loop. **Not** wired into `mobile-ci.yml` — no AVD in CI yet; that's the actual Stage 4.

### Fixture additions

`scripts/data/seed-fixtures/e2e/fixtures.mjs` (source of truth) + its `apps/mobile/e2e/lib/fixtures.ts` mirror gain, all built through the existing `build*Data` model builders so they can't drift:
- an **un-activated municipality** (no community overlay) for the organizer-request flow;
- a **super-admin** approver user;
- a **joiner** user (authed, non-member) for the join flow;
- a **fresh** auth-only user with no person doc for onboarding.

## File Structure

**Create**
- `apps/mobile/e2e/flows/organizer-request-approval.spec.ts`
- `apps/mobile/e2e/flows/org-create-approve-join.spec.ts`
- `apps/mobile/e2e/flows/create-publish-event.spec.ts`
- `apps/mobile/e2e/flows/onboarding-profile.spec.ts`
- `apps/mobile/e2e/native/flows/deep-link-event.yaml` — Maestro anonymous deep-link smoke.
- `apps/mobile/e2e/native/README.md` — the manual native-run loop (AVD + seed + dev-client build + `maestro test`).

**Modify**
- `apps/mobile/e2e/lib/emulatorState.ts` — add readers for `organizerRequests`, `municipalities` community state, `organizations` + members, `organizationJoinRequests`, `events` by municipality, `persons`/`users` profile.
- `apps/mobile/e2e/lib/fixtures.ts` — add un-activated municipality, super-admin, joiner, fresh user.
- `scripts/data/seed-fixtures/e2e/fixtures.mjs` — same additions via `build*Data` builders (source of truth).
- `apps/mobile/package.json` — `app:e2e:native` script (Maestro is a CLI — documented external install, likely not a package dep).
- Possibly new `testID`s on screens the flows drive (organizer request, org create/approve/join, event create, onboarding) where selectors are missing.
- `CHANGELOG.md` — note the added E2E coverage.
- `docs/plans/ongoing/e2e-substrate.md` — mark the deferred organizer-request flow as picked up here; note Stage 4 groundwork started.

## Tasks

Legend: `[x]` authored + agent-runnable-verified · `[~]` authored, verified only by CI `web-e2e` / the user on a device (agent can't run emulators/Playwright/AVD) · `[ ]` not started.

### Stage A1 — Substrate extensions (no flow yet)
- [ ] Extend `emulatorState.ts` with the readers the four flows assert on.
- [ ] Extend `fixtures.ts` + `scripts/data/seed-fixtures/e2e/fixtures.mjs` (un-activated municipality, super-admin, joiner, fresh user), via `build*Data` builders. Verify `pnpm seed:e2e` still seeds cleanly (CI / user).

### Stage A2 — Web flows (author, CI-verify)
- [ ] `create-publish-event.spec.ts` (simplest — single actor, reuses existing admin/org).
- [ ] `onboarding-profile.spec.ts` (fresh user).
- [ ] `organizer-request-approval.spec.ts` (the parent plan's deferred flow; two actors).
- [ ] `org-create-approve-join.spec.ts` (multi-step, three actors — most selector iteration expected).
- [ ] Add any missing `testID`s the flows need; iterate selectors from CI artifacts.

### Stage B — Native Maestro groundwork (manual/opt-in)
- [ ] `apps/mobile/e2e/native/flows/deep-link-event.yaml` anonymous smoke.
- [ ] `app:e2e:native` script + `native/README.md` (AVD → `10.0.2.2` override → seed → dev-client build → `maestro test`).
- [ ] Confirm the dev-client build with `USE_FIREBASE_EMULATOR=1` reaches the emulator via `10.0.2.2` (user, on a device).
- [ ] CHANGELOG + parent-plan status note.

## Out of scope (later / separate — Stage 4 proper)
- Full native Maestro suite (interactive flows: login, sign-up, org/event creation on device).
- Native **fixture-login mechanism** (deep-link login intent or testID dev button).
- Wiring Maestro/AVD into per-PR or release-gated CI.
- Coverage-gate flip (report-only → `diff-cover`).

## Notes for the implementing agent
- The agent **cannot** run emulators, Playwright, or an AVD (AGENTS.md "never start dev servers"). Web flows are authored + typecheck/lint-validated; the CI `web-e2e` job is the real gate. The native smoke is verified by the user on a device.
- Web flows: **strong assertion is always Firestore state via `emulatorState`**, UI-driving is the fragile half — tune selectors from CI trace artifacts.
- `mobile-web-compat` gotchas apply to any new screen the flows touch (`Alert.alert` no-op on web, NativeWind on `Animated.*`) — assert on web-visible outcomes.
- Keep fixtures built through `build*Data` model builders so they can't drift from schema (D5).
- Do NOT broaden the auth surface or the bypass-leak allowlist for the web flows — reuse the existing `fixtureLogin` seam.
