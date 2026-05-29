# Migrate to `@react-native-firebase/*` (native SDK)

## Context

Cultuvilla currently uses the Firebase **JS Web SDK** (`firebase` ^11.x) across `packages/shared` and `apps/mobile`. This was a deliberate choice so the same shared services run on:

- Expo / React Native (device)
- Expo Web export deployed to `villa-events.web.app` (see [project_firebase_hosting](../../../.claude/projects/-home-powervaro-githubs-cultuvilla/memory/project_firebase_hosting.md))

The trade-off is the standard one for Firebase + RN:

- **JS SDK on RN** uses an IndexedDB/AsyncStorage shim for persistence. Offline behavior is flaky, eviction is unpredictable, and auth-session persistence has known edge cases.
- **`@react-native-firebase/*`** wraps the native iOS/Android Firebase SDKs. Real SQLite-backed offline persistence, native Crashlytics, smaller JS bundle, more reliable auth. But it is native-only — there is no web implementation.

Ordago-apps (sister project) migrated in early 2026:

- PR #272 `chore/native-sdk-prep` — added `@react-native-firebase/{firestore,auth,functions}@24`, rewrote shared-test mocks.
- PR #273 `feat/native-sdk-migration` — cut services over.
- PR #291 `fix/storage-native-sdk-migration` — Cloud Storage to `@react-native-firebase/storage`.
- PRs #286 / #292 `feat/offline-ux-hardening` — 5-phase layer on top: callable-error classifier, `StaleStateModal`, server-authoritative reads on cancel/restart, connection-state banner, `useCallable` hook, live-subscribe ProfileScreen, `showCallableError` for organizer mutators.
- Crashlytics already runs via `@react-native-firebase/crashlytics` (commit fd10e8d7).

Ordago effectively dropped their web app before migrating, which made the cut-over single-target.

## Why this likely makes sense for cultuvilla eventually

- **Rural-village offline UX is core to the product premise** — patchy mobile signal in Spanish villages is exactly the scenario where SQLite-backed persistence pays off.
- **Crashlytics, push, dynamic links** all assume native SDK.
- **Smaller JS bundle on device** (~200 KB gzipped of JS-SDK code not used at runtime).
- **Auth-persistence regressions** that hit ordago (commit 3b0f070c "hotfix: automatic login persistence") will likely hit us too.

## Why not now

- Touches every file in `packages/shared/src/services/`, every vitest mock, the emulator wiring, and forces a dev-client rebuild (`expo prebuild`) flow if we aren't already on one.
- `villa-events.web.app` is currently our **only deployed surface**. Migrating now means either killing the web build or paying the platform-split tax.
- Ordago's migration was a multi-PR effort with a long tail of "this assumed JS-SDK shape" bug fixes. Realistic budget: ~1 week focused + 2–3 weeks of follow-up hardening.

## Trigger conditions (when to revisit)

Revisit this plan when **any** of the following is true:

1. The mobile app has shipped to App Store / Play Store and become the primary surface (web is no longer the only deployed UI).
2. Users report offline-related issues (blank screens on poor signal, lost writes, stale data after reconnect).
3. We need Crashlytics-grade crash reporting (Sentry isn't enough).
4. Auth session persistence starts producing bug reports.

Until one of those fires, the JS SDK stays.

## Approach when we do it (sketch)

Two options at decision time:

### Option A — drop the web build, single native codebase (recommended)

Mirrors ordago's path. Requires that web is no longer pulling real weight.

1. Confirm web traffic / role with stakeholders. Decide kill criteria.
2. Prep PR: add `@react-native-firebase/{app,auth,firestore,functions,storage,crashlytics}` to `apps/mobile`. Add alias mocks for vitest so `packages/shared` tests still pass against the JS-SDK shape.
3. Cut-over PR: rewrite each service in `packages/shared/src/services/` to import from `@react-native-firebase/*`. Update emulator wiring (`useEmulator` calls move to the RN-Firebase API). Update `firestore-deploy` and any test that touches a service.
4. Delete Expo web export pipeline (`pnpm app:web:build`, `deploy:hosting:*`, the CI smoke-test, the [project_firebase_hosting](../../../.claude/projects/-home-powervaro-githubs-cultuvilla/memory/project_firebase_hosting.md) setup).
5. Layer the ordago "offline-UX hardening" phases on top: callable-error classifier, stale-state modal, connection banner, `useCallable`, live-subscribe patterns, `showCallableError` for mutators.
6. `expo prebuild` + dev-client rebuild + AVD smoke.

### Option B — keep the web build, platform-split services

Only if web has a clear ongoing reason to exist.

- Service modules split into `service.native.ts` (uses `@react-native-firebase/*`) and `service.web.ts` (uses `firebase/*`). Metro picks `.native`, webpack picks `.web`.
- Every test needs two mock shapes; every service change has two implementations to keep in sync.
- Effectively doubles the surface area of `packages/shared/src/services/`. Not recommended unless web becomes a first-class product surface.

## Open questions (for future-us)

- Is web traffic on `villa-events.web.app` material at decision time, or is it just the demo URL?
- Do we keep Sentry alongside Crashlytics or pick one?
- Does the dev-client rebuild flow already exist (see [expo-native-rebuild skill](../../../.claude/skills/expo-native-rebuild/SKILL.md)) — yes it does, so this part is solved.

## Related

- [project_app_first](../../../.claude/projects/-home-powervaro-githubs-cultuvilla/memory/project_app_first.md) — single-app architecture decision.
- [project_firebase_hosting](../../../.claude/projects/-home-powervaro-githubs-cultuvilla/memory/project_firebase_hosting.md) — current web export setup; this plan would unwind it under Option A.
- [project_alert_on_web](../../../.claude/projects/-home-powervaro-githubs-cultuvilla/memory/project_alert_on_web.md), [project_animated_view_className](../../../.claude/projects/-home-powervaro-githubs-cultuvilla/memory/project_animated_view_className.md) — RN-Web gotchas that disappear if web is dropped.
