# Village location: edit-only, out of initiation

**Goal:** Remove the location/map step from the "Start village" activation flow and surface an admin-only "Añadir ubicación" placeholder on the village home when a village has no coordinates.

## Status

- **Updated:** 2026-07-04
- **Stage:** implementation complete; PR open, awaiting merge to `develop`.
- **Branch:** `feat/village-location-edit-only` (worktree `.claude/worktrees/village-location`)
- **Done:** all four stages implemented — backend params dropped + functions test rewritten; Start screen `LocationPicker` removed; village-home dashed "Añadir ubicación" placeholder added; i18n (`village.location.add` added, `start.locationLabel` removed); CHANGELOG entry. Static gate green: `check:no-raw-firestore-refs`, typecheck (shared/i18n/mobile/functions), lint (shared/functions), build (shared/functions).
- **Next:** CI green → user confirms merge → retire this plan (`git rm`). No decision doc warranted; rationale lives in CHANGELOG + code comments + the functions test.
- **Blockers:** emulator-backed `pnpm test` not run locally (repo forbids booting emulators — CI runs the new `startVillage` test). Manual mobile walkthrough still pending (see Tasks stage 4).
- **Handoff:** worktree deps installed (pnpm + `functions/` npm ci). Before merge: `git fetch origin develop && git rebase origin/develop`, re-run the static gate, `git push --force-with-lease`, wait for CI, then `gh pr merge --merge`. This plan should be deleted on merge.

## Context

Activating a dormant village currently asks the starter to fill in a location on a map (`LocationPicker` in the Start screen). This is confusing at initiation time — the person starting a village often isn't the eventual organizer and doesn't need to set coordinates to make the village joinable. Location is already fully optional on the model (`coordinates` + `mapZoom` are nullable on the municipality doc) and can already be edited post-activation by an organizer via the community editor's "Detalles" step. So the initiation prompt is redundant.

The fix: drop location from initiation entirely, and make the empty state discoverable — when an admin opens a village with no location, show a dashed map-shaped placeholder that opens the existing editor.

## Design / approach

1. **Remove location from the Start flow.** In `apps/mobile/app/discover/start/[municipalityId].tsx`, delete the `LocationPicker` block and its supporting state/effects/imports. Starting a village becomes: optional escudo + "I want to organize" toggle only.

2. **Delete the now-dead location params (Delete > deprecate).** `StartVillageScreen` is the only caller of `startVillage`, so drop `coordinates`/`mapZoom` from `StartVillagePayload` (`packages/shared/src/services/municipalityService.ts`) and from the `startVillage` Cloud Function (`functions/src/village/startVillage.ts`). Activation stops touching location; location is written only via the existing admin-only `updateMunicipality`.

3. **Dashed "Añadir ubicación" placeholder on the village home.** In `apps/mobile/components/feature/VillageHomeBody.tsx`, the map block renders only when `coordinates` exist. Add the complementary branch: when there is **no** location **and** the viewer `canManage`, render a full-width dashed rectangle matching the map footprint (`width:100%`, `aspectRatio:2.5`, `borderRadius:16`, dashed `border-subtle`) with a location-pin icon + "Añadir ubicación". Tapping routes to `/village/[villageId]/community` — the organizer editor whose first "Detalles" step already contains the `LocationPicker`. Non-managers see nothing there (unchanged).

   The dashed affordance mirrors the existing `AddCard` pattern in `VillageSections.tsx` (rounded, `border-dashed border-subtle`, icon + label), sized to the map rectangle instead of the square card.

4. **i18n.** Add `village.location.add` = "Añadir ubicación" to `packages/i18n/messages/es.json`; remove the now-orphaned `start.locationLabel`.

### Permissions

The placeholder is gated on `canManage` (`isAppAdmin || villageAdmin`), matching the existing "Editar" button and the community editor's own non-manager redirect. During the wiki phase (no organizer granted) only app admins can set location — already true today, since that editor is the only place location is ever set. This change does not expand who may edit location; it only makes the empty state visible.

## File structure

**Modify**
- `apps/mobile/app/discover/start/[municipalityId].tsx` — remove `LocationPicker`, `coords`/`zoom` state, seeding effect, unused imports; drop location args from the `startVillage` call.
- `apps/mobile/components/feature/VillageHomeBody.tsx` — add the `canManage && !coordinates` dashed placeholder branch.
- `packages/shared/src/services/municipalityService.ts` — remove `coordinates`/`mapZoom` from `StartVillagePayload`.
- `functions/src/village/startVillage.ts` — remove the `coordinates`/`mapZoom` data fields and their conditional writes.
- `packages/i18n/messages/es.json` — add `village.location.add`; remove `start.locationLabel`.

**Test**
- `functions/` — extend/add a vitest asserting `startVillage` no longer writes `coordinates`/`mapZoom`.

## Tasks

### Stage 1 — Backend + service (Delete > deprecate)
- [ ] Remove `coordinates`/`mapZoom` from `StartVillagePayload` and the `startVillage` service call site's type.
- [ ] Remove the `coordinates`/`mapZoom` fields + conditional writes from `functions/src/village/startVillage.ts`.
- [ ] Add/extend a functions vitest asserting activation does not write location fields.

### Stage 2 — Start screen
- [ ] Delete the `LocationPicker` block, `coords`/`zoom` state, the coordinate-seeding effect, and now-unused imports (`LocationPicker`, `MAP_ZOOM_DEFAULT`, `clampMapZoom`, `LatLng`).
- [ ] Drop `coordinates`/`mapZoom` from the `startVillage(...)` call.

### Stage 3 — Village home placeholder
- [ ] Add the `canManage && !village.coordinates` dashed "Añadir ubicación" rectangle in `VillageHomeBody.tsx`, routing to `/village/[villageId]/community`.
- [ ] Add `village.location.add` to `es.json`; remove orphaned `start.locationLabel`.

### Stage 4 — Verify
- [ ] `pnpm check` green (lint + typecheck + test + build).
- [ ] Manual: Start flow no longer shows the map; admin village home with no location shows the placeholder and it opens the editor; a village *with* coordinates still shows the map.

## Out of scope

- `VillageFormSchema` / `VillageFormValues` in `packages/shared` (search flagged it as possibly dead — used only by its own test). Leave unless separately requested.
- Letting non-admins / wiki-phase members set location (permissions unchanged).
- Any change to the `LocationPicker` component itself or the community editor.
