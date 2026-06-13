# Generalize `cemeteries` → `places` with a `kind` enum

**Goal:** Replace the municipality `cemeteries` subcollection with a generic `places` subcollection discriminated by a `kind` enum, so churches, hermitages, plazas, town halls (and future types) reuse one stack — while preserving the cemetery's load-bearing role as the target of `Person.burialPlace`.

## Status

- **Updated:** 2026-06-13
- **Stage:** Code complete (Stages 1–5). Stages 6 deferred (see below).
- **Branch:** repo `feat/places-generalization` (worktree at `.claude/worktrees/places-generalization`)
- **Done:** Shared data layer (model, `Person.burialPlace` FK, converters, refs, service, services-map); `firestore.rules` (`cemeteries`→`places`); mobile `places.tsx` + kind picker + admin hub link; i18n `places` namespace + kind labels; tests updated; docs swept (README, CHANGELOG, persons-registry decision, web-deletion-missing-screens). Verified: `shared:typecheck` ✅, `shared:test` 360 ✅, `test:rules` 102 ✅, `i18n:typecheck` ✅, `app:typecheck` ✅, `shared:lint` ✅, web-compat ✅, no-raw-firestore-refs ✅. Mobile jest 58/59 (the 1 failure is a pre-existing suite-ordering flake in `complete-profile.test.tsx`, passes in isolation, unrelated).
- **Next:** Review + merge. Then deploy rules to dev (`deploy:rules:dev`), then reset dev data (Stage 6).
- **Blockers:** none
- **Handoff:** Worktree needed both `pnpm install` and `npm --prefix functions install` to run vitest/rules. Dev phase — **no migration/backfill code**. Stage 6 (dev data wipe + recreate) is deliberately deferred until rules are deployed to dev, else the app would read `places` against stale `cemeteries` rules. Burial guard (kind==='cemetery' assertion) deferred — no mobile form writes `burialPlace` yet, so it guards nothing.

## Context

Today a cemetery is a municipality subcollection doc (`/municipalities/{id}/cemeteries/{cemeteryId}`) with `{ name, description, municipalityId, createdAt }`. It sits beside `barrios` (same pattern). Its one distinguishing feature: `Person.burialPlace = { municipalityId, cemeteryId }` is a typed FK meaning *specifically a cemetery* — symmetric with `Person.birthPlace → barrio`.

We want to add more notable-place types (iglesia, ermita, plaza, ayuntamiento) without copy-pasting the full ~8-file stack per type. Generalizing the *container* to `places` + a `kind` enum is the DRY move. Barrios stay separate (a barrio is an administrative subdivision, not a physical site).

## Decisions

- **Collection name:** `places` (broader than "buildings"; a plaza/fuente isn't a building).
- **Barrios:** untouched. Only cemetery generalizes.
- **`kind` enum (English identifiers, Spanish labels via i18n):** `cemetery`, `church`, `hermitage`, `plaza`, `town_hall`. `cemetery` is mandatory — it backs `burialPlace`.
- **Mobile UI:** one generalized `places.tsx` screen listing all places, with a `kind` selector in the add/edit form.
- **`burialPlace` shape:** `{ municipalityId, placeId }` (rename `cemeteryId` → `placeId`). Rules already validate it only as `isMapOrNull`, so the inner rename is free at the rules layer.
- **Cemetery semantics preserved two ways:** (1) the burial picker UI lists only `kind === 'cemetery'` places; (2) optional service-layer guard asserts the referenced place is a cemetery (see Task 8 — guardrail-enforcement).
- **No `kind` composite index:** a village has few places; `getPlaces` fetches all ordered by `name` and callers filter by `kind` in memory. Revisit if place counts grow.

## File Structure

**Model**
- `packages/shared/src/models/municipality/MunicipalityDataModel.ts` — replace `CemeteryDataSchema`/`CemeteryData`/`CemeteryDataInput`/`buildCemeteryData` with `PlaceKindSchema`, `PlaceDataSchema`, `PlaceData`, `PlaceDataInput`, `buildPlaceData`.
- `packages/shared/src/models/person/PersonDataModel.ts` — `BurialPlaceSchema`: `cemeteryId` → `placeId` (lines 19-23); follow through `PersonDataInput` (70) and `buildPersonData` (91).

**Converters** (rename files)
- `packages/shared/src/firebase/converters/cemeteryConverter.client.ts` → `placeConverter.client.ts` (`cemeteryConverterClient` → `placeConverterClient`, `CemeteryDataSchema` → `PlaceDataSchema`).
- `packages/shared/src/firebase/converters/cemeteryConverter.admin.ts` → `placeConverter.admin.ts` (same).

**Refs**
- `packages/shared/src/firebase/refs/client.ts` — `municipalityCemeteriesCollection` → `municipalityPlacesCollection`, `municipalityCemeteryDoc` → `municipalityPlaceDoc`, path `'cemeteries'` → `'places'`, import updated.
- `packages/shared/src/firebase/refs/admin.ts` — same.

**Services**
- `packages/shared/src/services/municipalityService.ts` — `getCemeteries`→`getPlaces`, `createCemetery`→`createPlace`, `updateCemetery`→`updatePlace`, `deleteCemetery`→`deletePlace`; imports + types updated.
- `packages/shared/src/services/_services-map.md` — update the ownership row + reference-data note.

**Rules**
- `firestore.rules` — `match /cemeteries/{cemeteryId}` → `match /places/{placeId}` (lines 428-431). `burialPlace` validation unchanged (`isMapOrNull`).

**Mobile UI**
- `apps/mobile/app/village/[villageId]/admin/cemeteries.tsx` → `places.tsx` — generalized list + `kind` picker in add/edit form; i18n keys `village.admin.cemeteries.*` → `village.admin.places.*`.
- `apps/mobile/app/village/[villageId]/admin/index.tsx` — import `getPlaces`, update stat label + nav route to `places`.

**i18n**
- `packages/i18n/messages/es.json` — rename `cemeteries` namespace → `places`; add `kind` labels (`cemetery`/`church`/`hermitage`/`plaza`/`townHall`); update hub label (line 169).

**Tests**
- `packages/shared/test/models/municipality/MunicipalityDataModel.test.ts` — `CemeteryDataSchema`/`buildCemeteryData` block → `PlaceDataSchema`/`buildPlaceData`, assert `kind` parsing.
- `packages/shared/test/models/person/PersonDataModel.test.ts` — `burialPlace.cemeteryId` → `placeId` in fixtures.
- `packages/shared/test/e2e/personRules.test.ts`, `shapeRules.test.ts` — `burialPlace: null` fixtures unchanged; verify still green.
- (Optional) add `getPlaces`/`createPlace` vitest coverage — none existed for cemetery.

**Docs** (text-only sweeps)
- `README.md` (16), `CHANGELOG.md` (69-70), `docs/architecture/web-deletion-missing-screens.md` (28), `docs/decisions/persons-registry.md` (19) — "cemeteries" → "places (incl. cemeteries)".

## Tasks

### Stage 1 — Shared data layer
- [x] Model: `PlaceKindSchema` + `PlaceDataSchema` + `buildPlaceData` replace cemetery schema in `MunicipalityDataModel.ts`.
- [x] Model: `BurialPlaceSchema.cemeteryId` → `placeId` in `PersonDataModel.ts` (+ input + builder).
- [x] Rename + rewrite both converters (`placeConverter.{client,admin}.ts`); delete old cemetery converter files.
- [x] Refs: rename collection/doc helpers + path in `client.ts` and `admin.ts`.
- [x] Service: rename the four CRUD fns in `municipalityService.ts`; add optional in-memory `kind` filter to `getPlaces`. Follow the `touch-service` skill.
- [x] Update `_services-map.md`.

### Stage 2 — Rules
- [x] `firestore.rules`: `cemeteries` → `places` match block. (Per `guardrail-enforcement`: write stays `isAppAdmin()`, read public.)

### Stage 3 — Mobile UI
- [x] Rename `cemeteries.tsx` → `places.tsx`; add `kind` picker; wire to renamed service fns.
- [x] Update admin `index.tsx` import, label, and nav route.
- [x] i18n: `places` namespace + kind labels in `es.json` (via `i18n-add-string` conventions).

### Stage 4 — Tests + verify
- [x] Update model tests (municipality + person).
- [x] Run `vitest` in `packages/shared`; run rules e2e tests; typecheck the monorepo.
- [x] Docs sweep (README, CHANGELOG, architecture, decision doc).

### Stage 5 — Dev data reset (NO migration)
- [ ] Via `firebase-admin-dev` skill: delete all `cemeteries` docs under every municipality; null out `Person.burialPlace` where set. Recreate sample `places` with assorted kinds for manual UI verification.
- [ ] (Optional, `firestore-deploy`) Deploy rules to dev once green.

### Stage 6 — Optional hardening
- [ ] Service guard: when setting `Person.burialPlace`, assert referenced place `kind === 'cemetery'` (decide layer via `guardrail-enforcement`). Skip if UI-level filtering is deemed sufficient.

## Out of scope

- Coordinates/GPS on places (additive field for later).
- Barrio generalization (intentionally kept separate).
- Web admin UI (mobile-only today).
- Migration/backfill code (dev phase — wipe & recreate instead).
