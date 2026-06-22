# Persona-a-cargo: village + barrio

**Goal:** When adding/editing a "persona a tu cargo", let the user pick the person's village (defaulting to their active village) and optionally a barrio within it, persisting to `PersonData.municipalityLinks`.

## Status

- **Updated:** 2026-06-22
- **Stage:** implemented, uncommitted — awaiting review/commit
- **Branch:** `main` (session started on `feat/censo-form-builder`; the working tree was switched to `main` mid-session by concurrent git activity, which discarded the first pass of edits — they were re-applied on `main`)
- **Done:** `buildResidenceLinks` helper + unit tests (16/16); `BarrioPicker` primitive + export; `PersonForm` village+barrio fields; `person/[personId].tsx` default-to-active-village + edit seed + build links on create/update; i18n keys. Verified: shared typecheck ✅, shared lint (touched files) ✅, 427/427 unit tests ✅, mobile typecheck ✅.
- **Next:** commit; optional manual smoke on the AVD.
- **Blockers:** none from this change. Pre-existing lint errors in `censoService.test.ts` and untracked `eventOrglessRules.test.ts` (other in-flight work) block the umbrella `pnpm check` but are unrelated.
- **Handoff:** es-only i18n catalog at `packages/i18n/messages/es.json`. `getPersonsByBarrio` matches `municipalityLinks` via exact `array-contains { municipalityId, barrioId }` — stored objects must have exactly those two keys. Changes are uncommitted; left for the user to commit given concurrent git operations.

## Context

`PersonData.municipalityLinks: MunicipalityLink[]` already exists and is queried by `getPersonsByBarrio`, but no form ever populated it. Dependents added today are linked to no village. This wires the residence picker that was always intended.

## Design / approach

- No schema change. A persona-a-cargo stores a single-element `municipalityLinks: [{ municipalityId, barrioId }]` (or `[]` when no village chosen). `barrioId` is `null` for "whole village".
- New `BarrioPicker` primitive loads approved barrios (`getBarrios` filtered to `status === 'approved'`) for the selected municipality; modal select styled like `VillagePicker`; disabled when no village selected; "Todo el pueblo" → `null`.
- `PersonForm` gains `municipalityId` + `barrioId` values, renders `VillagePicker` (label "Pueblo") + `BarrioPicker`. Changing village resets barrio to `null`.
- `person/[personId].tsx`: seed `municipalityId` from `profile.activeMunicipalityId` for new persons; from `person.municipalityLinks[0]` for edits. On submit build the `municipalityLinks` array for both create and update.

## File structure

- **Create:** `apps/mobile/components/primitives/BarrioPicker.tsx`
- **Modify:** `apps/mobile/components/primitives/index.ts` (export BarrioPicker)
- **Modify:** `apps/mobile/components/feature/PersonForm.tsx` (village + barrio fields)
- **Modify:** `apps/mobile/app/person/[personId].tsx` (default + seed + build municipalityLinks)
- **Modify:** `packages/i18n/messages/es.json` (`profile.personForm.{village,barrio,wholeVillage}`)
- **Modify/add:** `packages/shared/src/services/*.test.ts` (round-trip municipalityLinks w/ barrioId)

## Tasks

### Stage 1 — shared (data round-trip)
- [ ] RED/GREEN test: a person built with `municipalityLinks: [{municipalityId, barrioId}]` round-trips and is matched by an exact `array-contains` shape (barrioId set and null cases).

### Stage 2 — UI primitive
- [ ] `BarrioPicker` primitive + export. Loads approved barrios for `municipalityId`; "Todo el pueblo" option; disabled without a village.

### Stage 3 — form wiring
- [ ] `PersonForm`: add `municipalityId`/`barrioId` values, render pickers, reset barrio on village change.
- [ ] `person/[personId].tsx`: pull `profile`, seed default/edit values, build `municipalityLinks` on create + update.
- [ ] i18n keys.

### Stage 4 — verify
- [ ] `pnpm check` green; manual smoke optional.
