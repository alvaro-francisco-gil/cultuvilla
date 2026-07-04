# Changelog

All notable changes to this project. Format adapted from [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project ships via PRs with conventional commit messages and uses dated sections rather than semver releases.

## [Unreleased]

### Added
- **Scroll-to-top refresh on the web feed.** Both feeds already pull-to-refresh on native via `RefreshControl`, but that widget is inert on react-native-web, so the Firebase Hosting build had no refresh gesture. `useWebScrollTopRefresh` ([apps/mobile/lib/useWebScrollTopRefresh.ts](apps/mobile/lib/useWebScrollTopRefresh.ts)) attaches a `wheel` listener to each feed's scroll node and refetches when the user is already at the top and keeps scrolling up past a small threshold. Web-only (`Platform.OS === 'web'`), no-op on native; covered by jest tests.
- **Phone-number validation on event sign-up.** When an event requires a telephone, the attendee sheet now validates the number instead of only checking it's non-empty. A country-prefix selector (default 🇪🇸 +34) drives the rule: Spain requires 9 digits starting 6/7/8/9; other prefixes accept 4–14 digits. The prefix picker offers a **searchable, worldwide country list** (accent-insensitive name match + dial-code match), not a handful of curated countries. The invalid-number error appears **only after the user presses Confirmar** — not on every keystroke — so a half-typed number doesn't flash red. The number is stored in E.164 form (e.g. `+34600123456`). Logic lives in `@cultuvilla/shared/utils/phone` (`isValidPhoneNumber`, `formatPhoneE164`, `PHONE_COUNTRIES`, `parsePhoneE164`) with vitest coverage; the mobile `PhoneField` composes it. The **organizer-request flows** (start a village + "I want to organize", and request to organize an active village) now use the same `PhoneField`, validation, and E.164 storage via the shared `useOrganizerPhone` hook — replacing their plain non-empty check. The saved `profile.telephone` is parsed back into prefix + national on prefill (`parsePhoneE164`, which also tolerates legacy raw numbers). This changes the stored `users/{uid}.telephone` shape to E.164; the field is written only by these organizer screens and read nowhere else, so no backfill is needed (legacy raw values still parse for display).
- **Testing foundations** (first chunk of [docs/plans/ongoing/testing-enhancement.md](docs/plans/ongoing/testing-enhancement.md), inspired by the sibling `ordago-apps` repo):
  - **Report-only code coverage** across the monorepo — `@vitest/coverage-v8` in `packages/shared` + `functions`, Jest `v8` coverage in `apps/mobile`, and `vitest` newly wired into `packages/i18n`. Coverage is opt-in via `--coverage` (no CI gate yet — the plan gates on *patch* coverage later, never absolute total). New scripts: per-package `test:coverage` and a root `test:coverage:unit` aggregate.
  - **Shared emulator/rules test harness** at [packages/shared/test/helpers/rulesTestEnv.ts](packages/shared/test/helpers/rulesTestEnv.ts) (`useRulesTestEnv`/`createRulesTestEnv`) and [packages/shared/test/helpers/roles.ts](packages/shared/test/helpers/roles.ts) (`asUser`/`asAnon`/`asAdmin`/`seed`/`seedAdmin`). The 20 rules-e2e + integration tests were migrated off their copy-pasted `readFileSync(firestore.rules)` + `initializeTestEnvironment` + lifecycle boilerplate onto these helpers; `test/README.md` corrected to describe the real helpers (it previously referenced files that didn't exist).
  - **i18n key-parity tests** in [packages/i18n/test/](packages/i18n/test/) — cross-locale leaf-key parity (fails the moment a second locale drifts) and a static scan asserting every literal `t('...')` key used in `apps/mobile` (408 today, all resolving) exists in the catalog.
  - **Data-integrity invariant tests** at [packages/shared/test/validation/rulesShapeContract.test.ts](packages/shared/test/validation/rulesShapeContract.test.ts) — a pure, runnable cross-layer contract asserting each of the six create-gated model builders (`buildOrganizationData`, `buildOrgMemberData`, `buildOrganizationJoinRequestData`, `buildOccupationProposalData`, `buildPlaceData`, `buildBarrioData`) produces exactly the field set its `firestore.rules` `isValid*Create` validator permits, plus the shared pending/no-reviewer create defaults. Fails the moment a builder and its rule drift apart (a silent prod bug today).
  - **Coverage of two genuine gaps**: an e2e rules test for the `organizations/{orgId}` approve/reject **update** path (village-admin / app-admin allowed, member / outsider / anon denied) that `approveOrganization`/`rejectOrganization` rely on, and a `requestJoinOrganization` Cloud Function boundary test (unauthenticated / invalid / not-found / not-approved / already-member / duplicate / happy-path). The other request-type callables were already covered.
- **`apps/mobile/`** — Expo SDK 54 / Expo Router v4 / NativeWind v4 React Native scaffold. Consumes `@cultuvilla/shared` (services, design tokens, formatters) and `@cultuvilla/i18n` (message catalog). Firebase auth uses `getReactNativePersistence(AsyncStorage)` via the shared `customizeAuth` hook. v1 ships read flows: feed, event detail + register-to-event, villages list, village home, censo form, profile + photo upload, login/signup. EAS Build profiles `dev`/`beta`/`prod` match the existing Firebase env split. App Check seam wired (`initMobileAppCheck`) but no-op until product opts in. CI via `.github/workflows/mobile-ci.yml`. See [docs/decisions/mobile-app-scaffold.md](docs/decisions/mobile-app-scaffold.md).
- **Cloud Functions logging convention** documented in AGENTS.md: handlers use `logger.{info,warn,error}` from `firebase-functions/v2` with a structured second arg so Cloud Logging treats them as `jsonPayload` (searchable). The lone existing `console.*` call site (`onOccupationProposalApproved.ts`) was migrated.
- **Invariant test** at [functions/src/__tests__/helpers/no-console.test.ts](functions/src/__tests__/helpers/no-console.test.ts) — scans `functions/src/` and fails the build if any `console.*` call slips back in.
- **`registerToEvent` callable** at [functions/src/registerToEvent.ts](functions/src/registerToEvent.ts) runs the capacity-vs-waitlist decision and write in a Firestore transaction, replacing the client-side read-then-write batch that had a TOCTOU race. Writes `isMember` on each registration (denormalized from the village `members/` collection at write time) so attendee lists no longer need a per-user `isVillageMember` fan-out. Pure helpers under [functions/src/helpers/registerToEventValidation.ts](functions/src/helpers/registerToEventValidation.ts) for fast unit coverage.
- **Denormalized `confirmedCount` / `totalCount` on event docs**: `registerToEvent` writes them in the transaction; `onRegistrationDeleted` recomputes after delete + promotion. Lets feeds and event cards render attendee counts without an extra `getCountFromServer` round-trip. Pre-existing events get correct counts on the next registration write or cancellation.
- **Design system tokens** at [packages/shared/src/design-system/](packages/shared/src/design-system/) — spacing (4-based scale), typography (7 variants), semantic colors (light mode; dark added via `colors.dark` later), radii, elevation (web + RN shapes), z-index named layers, a11y constants (min touch target, default hit slop), icon sizes. See [packages/shared/src/design-system/README.md](packages/shared/src/design-system/README.md).
- **`@cultuvilla/i18n` workspace** at [packages/i18n/](packages/i18n/) — message catalog hoisted into its own workspace, consumed by the mobile app via the thin `useT()` adapter in `apps/mobile/lib/i18n.tsx`.
- **Locale formatting helpers** at [packages/shared/src/utils/format.ts](packages/shared/src/utils/format.ts) — `formatDate`, `formatPrice`, `formatRelativeTime`, all preset to `es-ES`.

### Changed
- **Village location moved out of the activation flow.** Starting a village no longer asks for coordinates or a map — activation is now just the optional escudo plus the "I want to organize" toggle. Location is set afterwards by an admin: when a village has no coordinates, its home shows a dashed "Añadir ubicación" placeholder (in the map's footprint, mirroring the create-event/article cards) that opens the organizer's *Detalles* editor, where the location picker already lives. The `startVillage` callable/service no longer accept `coordinates`/`mapZoom`; location writes go solely through the admin-only `updateMunicipality` edit path.
- **Generalized the `cemeteries` municipality subcollection to `places`** discriminated by a `kind` enum (`cemetery`, `church`, `hermitage`, `plaza`, `town_hall`), so notable village sites beyond cemeteries reuse one stack. `Person.burialPlace` now carries `{ municipalityId, placeId }` (was `cemeteryId`) and references a place with `kind === 'cemetery'`. The mobile admin screen is now `places.tsx` with a kind picker. Dev-phase change — data is wiped and recreated, no migration. Barrios remain a separate concept (administrative subdivisions, not physical sites).
- **CI: Java 17 → 21** for the emulator-tests job. `firebase-tools@15` will drop support for Java < 21; bumping ahead of the deprecation removes the runtime warning and keeps the job working when firebase-tools rolls forward.
- **Shared Firebase init is now config-injected** ([packages/shared/src/firebase/firebaseApp.ts](packages/shared/src/firebase/firebaseApp.ts)). Apps call `initFirebase(config, opts?)` once at startup and consume `getDb()`, `getAuth()`, `getFirebaseStorage()`, `getFirebaseFunctions()`, `getFirebaseApp()` accessors. The previous `process.env.NEXT_PUBLIC_*`-baked singleton was a hard blocker for the React Native app (Expo doesn't expose those env vars and RN needs `getReactNativePersistence` for auth). The mobile app initializes it at bootstrap and passes a `customizeAuth` hook to register `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })`.
- **`firebase` moved from `dependencies` to `peerDependencies`** in `@cultuvilla/shared`, so the consuming app owns the SDK instance and Metro/Next don't end up with two copies in a monorepo.
- **`imageService` is now `Blob`-based**: `uploadMunicipalityImage` and `uploadPersonImage` accept `{ blob, filename, contentType? }` instead of a web `File`. Mobile consumers pass a `Blob` obtained via `pickImageAsBlob`.
- **`registerToEvent` is now a callable wrapper** in [packages/shared/src/services/registrationService.ts](packages/shared/src/services/registrationService.ts). Drops the legacy client-side `getConfirmedCount` + `writeBatch` path. Signature changed from `(eventId, inputs, maxAttendees)` to `(eventId, registrants)`; `userId` is read from `request.auth.uid` server-side and no longer accepted in the input.
- **Firestore rules**: `events/{eventId}/registrations/{regId}` `allow create: if false` — the callable is the only sanctioned write path.
- **`useRegistrations`** drops the separate `getConfirmedCount` round-trip and derives `confirmedCount` from the already-loaded registration list. Event detail page reads `reg.isMember` directly, eliminating the O(N) `isVillageMember` fan-out on each view.

### Fixed
- **Explora feed dropped same-day and in-progress events.** `getUpcomingFeed` filtered `startDate >= now`, so an event that had already started today (or a multi-day event mid-run) vanished from Explora even though the rest of the system still treats it as live — `completeExpiredEvents` only flips an event to `completed` once its *last day* is over (`isEventOngoing` / `eventEndBoundary`). Events now carry a derived `endBoundary` field (`endDate ?? startDate`), written by `buildEventData` and recomputed in `updateEvent`; the feed ranges/orders on `endBoundary >= startOfToday` instead, so events stay visible for the whole of their (last) day and drop out only once the scheduler completes them. New composite index `events (status, endBoundary)`; rules require and validate `endBoundary`; existing dev docs backfilled via `scripts/backfill-event-endboundary.mjs`.
- **Profile creation no longer crashes on the read right after submit.** `UserDataSchema.displayName` is a denormalized projection written only by the async `syncPersonDenormalization` trigger; `createUserProfile` omits it, so a read in the window before the trigger lands (`refreshProfile()` in onboarding) hit a doc with no `displayName` and the strict converter threw `expected string, received undefined`. The schema now uses `z.string().default('')`, so such a read degrades to `""` (matching the field's documented contract) and self-heals once the trigger propagates. Regression covered by a new `userConverter` round-trip test of the exact displayName-less payload.

### Removed
- **`apps/web/` (Next.js App Router web app) deleted** in favor of `apps/mobile/` (Expo + React Native, which also serves the web build via React Native Web). The design tokens, primitives, i18n catalog, and config-injected Firebase init that were originally built web-first now live in / are consumed by the mobile app. See [docs/architecture/web-deletion-missing-screens.md](docs/architecture/web-deletion-missing-screens.md) for the screens still to be reimplemented on mobile.

### Notes for deploy
- Pre-existing events have no `confirmedCount` / `totalCount` until the next registration write or cancellation triggers a recompute. UIs that need these counts before that should fall back to a count query (or run a one-shot backfill).
- Pre-existing registrations have no `isMember`. The event detail page treats missing as `false` (shown as "Visitante"). A backfill helper can be added in a follow-up if needed.

## 2026-05-19 — Workflow conventions (PR #2)

### Changed
- **AGENTS.md** now codifies the development workflow: work in a git worktree (not in the main checkout), add tests whenever possible, open a pull request (not direct-to-main), wait for explicit user confirmation before merging, **rebase the branch onto the latest `main` (and re-run CI) before merging**, and **merge with a merge commit** (`gh pr merge --merge`) rather than squash or rebase-merge so the per-commit scope is preserved. The "things to flag in PRs" list grew two entries: untested code changes and work that landed outside a worktree.

## 2026-05-19 — Ordago-apps conventions uplift (PR #1)

### Added
- **AGENTS.md** at repo root: load-bearing conventions for human and AI contributors (service-layer ownership, denormalization pattern, strict TS, no `any`, conventional commits, delete > deprecate).
- **Services map** at [packages/shared/src/services/_services-map.md](packages/shared/src/services/_services-map.md): canonical list of every Firebase-touching service, the collection it owns, and key entry points. Also documents denormalized fields and their syncing triggers.
- **Denormalized read-model pattern doc** at [docs/architecture/denormalized-read-models.md](docs/architecture/denormalized-read-models.md): when to denormalize, the canonical trigger structure, failure modes, and the checklist for adding a new denormalized field.
- **Pre-commit hygiene**: Husky + lint-staged + commitlint. Pre-commit runs `eslint --max-warnings 0 --fix` on changed `apps/web` TypeScript files. Commit-msg enforces conventional commits with a 100-char header limit.
- **ESLint `no-restricted-imports`** in `apps/web`: blocks direct `firebase/firestore`, `firebase/storage`, `firebase/functions`, and `firebase/auth` imports outside the documented auth boundary. `GeoPoint`, `Timestamp`, and the `User` type are now re-exported from `@cultuvilla/shared/firebase`.
- **ESLint `@typescript-eslint/no-explicit-any: error`** in `apps/web`: no `any` allowed; use `unknown` or a precise type. (Pre-emptive: cultuvilla had no `any` in `apps/web` source before this rule landed.)
- Tests for the new firebase re-exports and apps/web ESLint rules under `packages/shared/test/firebase/` and `packages/shared/test/eslint/`.

### Changed
- `pnpm web:lint` (and the root `pnpm lint`) now runs `eslint . --max-warnings 0`. Warnings break the build.
- `@next/next/no-img-element` disabled with an inline justification: `next.config.ts` sets `images.unoptimized = true`, which makes `<img>` and `next/image` equivalent, and Firebase Storage signed URLs would require `remotePatterns` upkeep.
- Two pre-existing unused-import warnings in `apps/web` fixed so `--max-warnings 0` could land cleanly.

### Notes for future work
The following items from the ordago-apps uplift survey were proposed but not landed:
- Firebase Emulator Suite + vitest integration tests.
- Multi-environment Firebase setup (dev / beta / prod).
- Sentry on the web app; structured logging in Cloud Functions.
- `react-hook-form` + `zod` for forms.
- TanStack Query (or SWR) for a data-fetching cache.
- Global error boundary.

## 2026-05-17 — Renamed to Cultuvilla
- Project renamed from `villa-events` to `cultuvilla`. Live repo at `/home/powervaro/githubs/cultuvilla`. Shared package alias is `@cultuvilla/shared`. Firebase project ID remains `villa-events` for continuity with live data.
- Added `vitest` to `packages/shared` with model tests; added `pnpm check` aggregating lint + typecheck + test + build.
- Added GitHub Actions CI workflow that runs the same gate on push to main and PRs.

## 2026-05-13 — Superadmin pages and occupation taxonomy
- Superadmin pages for municipalities, barrios, cemeteries, occupations, and proposals.
- Person form now picks municipality / barrio / cemetery and offers a multi-select for occupations with a proposal flow (`occupationService.proposeOccupation`).
- Cloud Function auto-promotes pending occupation proposals on approval; proposer `displayName` shown in the admin proposals page.
- Seed script for the Spanish INE municipalities dataset (provincial capitals) under `scripts/seed-municipalities.mjs`.

## 2026-04-29 — Open feed
- Cross-village upcoming feed via Firestore collection group queries with optional haversine "nearby" filter.
- Village denormalization trigger that propagates `name`, `images[0]`, and `coordinates` from each `villages/{vid}` document onto its events (`villageName`, `villageCoverImage`, `villageCoordinates`).

## 2026-04-25 — Village censo
- Village censo (per-village profile schema) defined in `packages/shared/src/models/village/CensoTypes.ts`.
- `updateCensoSchema` Cloud Function performs schema-transition validation (duplicate keys, unknown predefined fields, invalid custom keys); `saveProfileAnswers` writes user answers and marks `profileCompletedAt` when all required fields are present.

## 2026-04-05 — Initial platform design
- Single Firebase project; data nested under `villages/{villageId}/`; collection group indexes for cross-village queries.
- Six user types (anonymous visitor, authenticated user, village member, org member, village admin, superadmin) and three org types (ayuntamiento, peña, asociación).
- Persona model: up to 50 proxy profiles per user for family-member sign-ups (renamed from `personas/` to `persons/` collection later that month).
- Next.js App Router web app under `apps/web`; shared types and services under `packages/shared`; Cloud Functions under `functions/`.
- Spanish default with `next-intl`; WhatsApp notifications deferred to later.
- Initial Cloud Functions: `acceptInvite`, `waitlistPromotion`, `eventCompletion`, `notificationTriggers`.

---

For commit-level history see `git log`. For design rationale see [docs/decisions/](docs/decisions/).
