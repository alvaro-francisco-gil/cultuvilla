# Changelog

All notable changes to this project. Format adapted from [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project ships via PRs with conventional commit messages and uses dated sections rather than semver releases.

## [Unreleased]

### Added
- **Cloud Functions logging convention** documented in AGENTS.md: handlers use `logger.{info,warn,error}` from `firebase-functions/v2` with a structured second arg so Cloud Logging treats them as `jsonPayload` (searchable). The lone existing `console.*` call site (`onOccupationProposalApproved.ts`) was migrated.
- **Invariant test** at [functions/src/__tests__/helpers/no-console.test.ts](functions/src/__tests__/helpers/no-console.test.ts) — scans `functions/src/` and fails the build if any `console.*` call slips back in.
- **`registerToEvent` callable** at [functions/src/registerToEvent.ts](functions/src/registerToEvent.ts) runs the capacity-vs-waitlist decision and write in a Firestore transaction, replacing the client-side read-then-write batch that had a TOCTOU race. Writes `isMember` on each registration (denormalized from the village `members/` collection at write time) so attendee lists no longer need a per-user `isVillageMember` fan-out. Pure helpers under [functions/src/helpers/registerToEventValidation.ts](functions/src/helpers/registerToEventValidation.ts) for fast unit coverage.
- **Denormalized `confirmedCount` / `totalCount` on event docs**: `registerToEvent` writes them in the transaction; `onRegistrationDeleted` recomputes after delete + promotion. Lets feeds and event cards render attendee counts without an extra `getCountFromServer` round-trip. Pre-existing events get correct counts on the next registration write or cancellation.

### Changed
- **CI: Java 17 → 21** for the emulator-tests job. `firebase-tools@15` will drop support for Java < 21; bumping ahead of the deprecation removes the runtime warning and keeps the job working when firebase-tools rolls forward.
- **Shared Firebase init is now config-injected** ([packages/shared/src/firebase/firebaseApp.ts](packages/shared/src/firebase/firebaseApp.ts)). Apps call `initFirebase(config, opts?)` once at startup and consume `getDb()`, `getAuth()`, `getFirebaseStorage()`, `getFirebaseFunctions()`, `getFirebaseApp()` accessors. The previous `process.env.NEXT_PUBLIC_*`-baked singleton was a hard blocker for a future React Native app (Expo doesn't expose those env vars and RN needs `getReactNativePersistence` for auth). The web app now initializes from `apps/web/lib/firebaseInit.ts`. RN apps can pass a `customizeAuth` hook to register `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })`.
- **`firebase` moved from `dependencies` to `peerDependencies`** in `@cultuvilla/shared`, so the consuming app owns the SDK instance and Metro/Next don't end up with two copies in a monorepo.
- **`imageService` is now `Blob`-based**: `uploadMunicipalityImage` and `uploadPersonImage` accept `{ blob, filename, contentType? }` instead of a web `File`. RN consumers will pass `await fetch(uri).then(r => r.blob())`; web call sites wrap the `File` (which is already a `Blob`) inline.
- **Web `registerToEvent` is now a callable wrapper** in [packages/shared/src/services/registrationService.ts](packages/shared/src/services/registrationService.ts). Drops the legacy client-side `getConfirmedCount` + `writeBatch` path. Signature changed from `(eventId, inputs, maxAttendees)` to `(eventId, registrants)`; `userId` is read from `request.auth.uid` server-side and no longer accepted in the input.
- **Firestore rules**: `events/{eventId}/registrations/{regId}` `allow create: if false` — the callable is the only sanctioned write path.
- **`useRegistrations`** drops the separate `getConfirmedCount` round-trip and derives `confirmedCount` from the already-loaded registration list. Event detail page reads `reg.isMember` directly, eliminating the O(N) `isVillageMember` fan-out on each view.

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

For commit-level history see `git log`. For design rationale see [docs/superpowers/specs/](docs/superpowers/specs/).
