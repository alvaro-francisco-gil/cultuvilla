# Village tab cleanup & escudo-only images

**Goal:** Simplify the village tab — remove the info modal, give admins an "Editar pueblo" entry point in place of the share button, and make the escudo the village's only image (drop `coverImages` entirely).

## Context

The village tab (`apps/mobile/app/(tabs)/village.tsx` → `VillageHomeBody.tsx`) currently shows an info-circle icon next to the village name that opens `VillageInfoModal`. That modal holds three things: the village description, an admin "Editar" button, and a Pinterest-style gallery of `community.coverImages`.

We want villages to carry **only an escudo** as their image. The Wikidata-sourced escudo (`escudoUrl`) is the default; a village admin may upload a custom one (`escudoManualUrl`, which already overrides Wikidata everywhere). The separate `coverImages` gallery concept goes away — the eventual richer "village photos" feature is captured separately in `village-user-photos.md` (ideas).

`coverImages` is woven through more than the tab: OG share-preview images, the event-card background denorm (`municipalityCoverImage`), the organizer-request / start-village / update-village write paths, the create/edit forms, and several seed scripts and tests. This plan removes all of it.

## Design / approach

### 1. Village tab header & buttons (`VillageHomeBody.tsx`)

- Remove the info-circle `Pressable` next to the village name and the `<VillageInfoModal>` render + its import.
- Delete `apps/mobile/components/feature/VillageInfoModal.tsx` (becomes unused) and the modal mock in `apps/mobile/app/(tabs)/__tests__/village.test.tsx`.
- The description and gallery that lived in the modal are dropped from the tab.
- Button row below the stats:
  - **Invitar vecino** — unchanged, shown to everyone.
  - Second slot is conditional on `canManage`:
    - admin → **Editar pueblo**, `router.push('/village/{id}/community')` (same target the modal's Editar button used).
    - non-admin → **Compartir pueblo** (current share behavior, unchanged).
- The wiki-phase plain-member "Editar" inline link stays as-is.

### 2. Escudo is the only village image

- Custom-escudo upload via the existing `escudoManualUrl` is kept and remains **always overridable** (an admin may upload a custom image even when a Wikidata escudo exists). No data-model change for the escudo itself.

### 3. Full `coverImages` removal

Remove the field and every reference:

- **Shared models:** drop `coverImages` from `VillageCommunitySchema`, `buildVillageCommunity`, `ActivateCommunityInput` (all in `MunicipalityDataModel.ts`); from `VillageFormSchema`; and from `OrganizerRequestDataSchema` / `buildOrganizerRequestData` / `OrganizerRequestDataInput`.
- **Functions:** `startVillage`, `updateVillageInfo`, `requestOrganizeVillage`, `respondToOrganizerRequest` stop reading/writing `coverImages`. Delete `functions/src/helpers/villageCoverImages.ts` (storage-cleanup helper) and its call sites.
- **Admin / create / edit UI:** remove the cover-image picker from `CommunitySettingsEditor.tsx`, `app/village/[villageId]/edit-info.tsx`, and the `app/discover/start/[municipalityId].tsx` create flow. These forms keep the **description** field (see below); they just lose the image picker.
- **Seeds & docs:** strip `coverImages` from `scripts/seed/villages.mjs`, `scripts/seed/events.mjs`, `scripts/seed-village-requests.mjs`, `scripts/data/seed-fixtures/*/fixtures.mjs`, and the image-entity note in `apps/mobile/AGENTS.md`.
- **Tests:** update all `coverImages` fixtures/assertions (`MunicipalityDataModel.test.ts`, `OrganizerRequestDataModel.test.ts`, `VillageFormSchema.test.ts`, `updateVillageInfo.test.ts`, `village.test.tsx`, `VillageHomeBody.test.tsx`, etc.).

### 4. Re-sourced fallbacks (decided)

Two consumers currently read `coverImages[0]`; both fall back to the **escudo** instead:

| Consumer | Before | After |
|---|---|---|
| OG village share-preview image (`functions/src/og/fetchers.ts`) | `coverImages[0] ?? escudoManualUrl ?? escudoUrl` | `escudoManualUrl ?? escudoUrl` (drop the cover term; also drop `coverImages` from `RawVillage`) |
| Event-card background (`functions/src/village/syncVillageDenormalization.ts` → `municipalityCoverImage`) | `coverImages[0]` | escudo (`escudoManualUrl ?? escudoUrl`); retrigger denorm on escudo-field changes, not on `community.coverImages` |

### 5. Description (decided)

The village description is **kept as an editable field** in the create/edit forms because it still feeds OG share previews. It is simply **no longer rendered** on the village tab (the modal that displayed it is gone).

### 6. In-flight plans to update

Both reference `coverImages` and must be edited to reflect the escudo fallback:
- `docs/plans/ongoing/og-share-link-previews.md` — the village-preview image source table.
- `docs/plans/ready/pueblo-location-map.md` — the `updateCommunity(..., { coverImages })` call.

### 7. Dev backfill (decided)

After the code change, run a one-off dev backfill that **deletes the dangling `coverImages` key** from existing Firestore docs (via `FieldValue.delete()`), so no legacy doc carries it:
- `/municipalities/{id}` → `community.coverImages`
- `/municipalities/{id}/organizerRequests/{reqId}` → `coverImages` (whatever the actual subcollection path is — verify)

Run against the **dev** project (`villa-events`) only, via the firebase-admin SDK (see the `firebase-admin-dev` skill). Idempotent: re-running on already-cleaned docs is a no-op.

**Strict-converter concern — resolved.** `makeConverter` (`packages/shared/src/firebase/converters/makeConverter.ts`) validates reads with plain `schema.parse()`, and zod object schemas **strip unknown keys by default** (no `.strict()`). So legacy docs that still carry `coverImages` read back fine after the field is removed from the schema — the key is silently dropped. No tolerant-read ordering is required; the backfill is pure housekeeping to keep stored docs clean, and can run any time after deploy.

---

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this task-by-task. Steps use `- [ ]` checkboxes for tracking. Layer-specific skills are named per task: `touch-service`, `cloud-function-logging`, `i18n-add-string`, `mobile-web-compat`, `firestore-deploy`, `firebase-admin-dev`.

## Global Constraints

- `pnpm check` (typecheck + lint + tests across the workspace) must pass before every commit.
- Spanish-only message catalog at `packages/i18n/messages/es.json` (no `en.json` exists). User-facing strings go through `useT()`/`t(...)`; follow the `i18n-add-string` skill.
- Functions deploy to the **dev** project `villa-events` only, via the `firestore-deploy` skill. Never beta/prod.
- Cloud Function logging uses `logger.*(msg, { handler, ...fields })` (the `cloud-function-logging` skill); no `console.*`.
- `coverImages` removal is total: after this plan, `rg -n 'coverImages' --glob '!**/node_modules/**'` returns **zero** matches outside git history.

## File Structure

**Shared models / services (`packages/shared/`)**
- Modify `src/models/municipality/MunicipalityDataModel.ts` — drop `coverImages` from `VillageCommunitySchema`, `buildVillageCommunity`, `ActivateCommunityInput`.
- Modify `src/models/municipality/VillageFormSchema.ts` — drop `coverImages`.
- Modify `src/models/municipality/OrganizerRequestDataModel.ts` — drop `coverImages` from schema, input, builder.
- Modify `src/services/municipalityService.ts` — drop `coverImages` from `StartVillagePayload`, `UpdateVillageInfoPayload`, and the `updateCommunity` `Pick`.
- Modify `src/services/imageService.ts` — delete `uploadVillageCoverImage` (becomes unused).
- Modify tests: `test/models/municipality/MunicipalityDataModel.test.ts`, `test/models/municipality/OrganizerRequestDataModel.test.ts`, `test/models/VillageFormSchema.test.ts`.

**Functions (`functions/`)**
- Modify `src/village/startVillage.ts`, `src/village/updateVillageInfo.ts`, `src/village/requestOrganizeVillage.ts` — stop reading/writing `coverImages`.
- Modify `src/village/respondToOrganizerRequest.ts` — comment only (drops `coverImages` mention).
- Delete `src/helpers/villageCoverImages.ts` (dead: no call sites).
- Modify `src/og/fetchers.ts` — `getVillageOg` image = `escudoManualUrl ?? escudoUrl`; drop `coverImages` from `RawVillage`.
- Modify `src/village/syncVillageDenormalization.ts` — `pickCover` → escudo; retrigger on escudo-field change.
- Modify tests: `src/__tests__/handlers/updateVillageInfo.test.ts`, `.../startVillage.test.ts`, `.../requestOrganizeVillage.test.ts`, `.../respondToOrganizerRequest.test.ts`, `.../og/render.test.ts`, and any denorm test.

**Mobile (`apps/mobile/`)**
- Modify `components/feature/VillageHomeBody.tsx` — remove info-icon + modal; conditional Editar/Compartir button.
- Delete `components/feature/VillageInfoModal.tsx`.
- Modify `app/(tabs)/__tests__/village.test.tsx` — remove the `VillageInfoModal` mock.
- Modify `components/feature/__tests__/VillageHomeBody.test.tsx` — assert new button behavior.
- Modify `components/feature/CommunitySettingsEditor.tsx` — remove images section + state.
- Modify `app/village/[villageId]/edit-info.tsx` — remove images section + state.
- Modify `app/discover/start/[municipalityId].tsx` — remove covers picker + upload.
- Modify `packages/i18n/messages/es.json` — add `village.edit.title`; remove now-unused image/cover/info keys.

**Seeds & docs**
- Modify `scripts/seed/villages.mjs`, `scripts/seed/events.mjs`, `scripts/seed-village-requests.mjs`, `scripts/data/seed-fixtures/demo_1/fixtures.mjs`, `scripts/data/seed-fixtures/real_villages_1/fixtures.mjs`, `apps/mobile/AGENTS.md`.
- Modify `docs/plans/ongoing/og-share-link-previews.md`, `docs/plans/ready/pueblo-location-map.md`.

**Backfill**
- Create `scripts/backfill/delete-cover-images.mjs` (one-off; run against dev, then keep or delete per repo norm).

## Tasks

### Task 1: Remove `coverImages` from shared models & services

**Files:**
- Modify: `packages/shared/src/models/municipality/MunicipalityDataModel.ts` (lines 15–25, 128–143)
- Modify: `packages/shared/src/models/municipality/VillageFormSchema.ts:31`
- Modify: `packages/shared/src/models/municipality/OrganizerRequestDataModel.ts` (lines 6–44)
- Modify: `packages/shared/src/services/municipalityService.ts` (lines 202–242)
- Modify: `packages/shared/src/services/imageService.ts` (delete `uploadVillageCoverImage`, ~line 63)
- Test: the three `*.test.ts` model files above.

> Use the `touch-service` skill before editing `municipalityService.ts` / `imageService.ts`.

This is a deletion, so the test cycle is: update the tests to no longer reference `coverImages`, edit the source, then run the suite green.

- [ ] **Step 1: Update model tests.** In `MunicipalityDataModel.test.ts`, remove every `coverImages: []` line from `VillageCommunity` fixtures and the `it('defaults coverImages to [] ...')` assertion (keep the `profileForm` half — rename the test to `'defaults profileForm to null'`). In `OrganizerRequestDataModel.test.ts`, remove `coverImages` from `validRequest`, the legacy-doc destructure (`const { description: _d, coverImages: _c, ...legacy }` → `const { description: _d, ...legacy }`), and the `expect(...coverImages).toEqual([])` / `expect(...coverImages).toEqual([...])` assertions; keep the description-default coverage. In `VillageFormSchema.test.ts`, remove the `coverImages: []` fixture lines, the `expect(result.data.coverImages)...` assertions, and the `it('defaults coverImages to []')` test.

- [ ] **Step 2: Edit the schemas.** In `MunicipalityDataModel.ts`: delete `coverImages: z.array(z.string()),` from `VillageCommunitySchema`; delete `coverImages?: string[];` from `ActivateCommunityInput`; delete `coverImages: input.coverImages ?? [],` from `buildVillageCommunity`. In `VillageFormSchema.ts`: delete `coverImages: z.array(z.string()).default([]),`. In `OrganizerRequestDataModel.ts`: delete the `coverImages` schema field (and its doc comment), `coverImages?: string[];` from the input interface, and `coverImages: input.coverImages ?? [],` from the builder.

- [ ] **Step 3: Edit the services.** In `municipalityService.ts`: remove `coverImages?: string[];` from `StartVillagePayload` and `UpdateVillageInfoPayload`; change `updateCommunity`'s param to `Partial<Pick<VillageCommunity, 'description' | 'adminUserId'>>` and delete the `if (data.coverImages !== undefined) ...` line. In `imageService.ts`: delete the `uploadVillageCoverImage` function.

- [ ] **Step 4: Run shared tests + typecheck.**

```bash
pnpm --filter @cultuvilla/shared test
pnpm --filter @cultuvilla/shared typecheck
```
Expected: PASS. (A `tsc` error in `discover/start` or `imageService` consumers is expected here and is fixed in Task 4 — if running the full `pnpm check`, defer it until then.)

- [ ] **Step 5: Commit.**

```bash
git add packages/shared
git commit -m "refactor(shared): drop coverImages from village models & services"
```

### Task 2: Remove `coverImages` from Cloud Function write paths

**Files:**
- Modify: `functions/src/village/startVillage.ts` (lines 9–13, 33, 54–56)
- Modify: `functions/src/village/updateVillageInfo.ts` (lines 12–16, 37, 70–74)
- Modify: `functions/src/village/requestOrganizeVillage.ts` (lines 13–18, 35, 41–43, 71–81)
- Modify: `functions/src/village/respondToOrganizerRequest.ts:90` (comment)
- Delete: `functions/src/helpers/villageCoverImages.ts`
- Test: `functions/src/__tests__/handlers/{startVillage,updateVillageInfo,requestOrganizeVillage,respondToOrganizerRequest}.test.ts`

> `cloud-function-logging` skill: leave existing `logger.info(..., { handler, ... })` calls intact; do not add `console.*`.

- [ ] **Step 1: Update the handler tests** to remove `coverImages` from input data and from expected written docs. E.g. in `updateVillageInfo.test.ts`: drop `coverImages: []` from the seeded `community`, change the call `data: { ..., coverImages: ['https://x/c.jpg'] }` to omit it, and remove `expect(muniDoc.data()?.community?.coverImages).toEqual(...)`. Do the equivalent in the other three handler tests (search each for `coverImages`).

- [ ] **Step 2: Edit `startVillage.ts`** — remove `coverImages?: string[];` from `StartVillageData`, drop `coverImages` from the destructure, and delete the `coverImages: Array.isArray(coverImages) ? coverImages : [],` line in the written `community`.

- [ ] **Step 3: Edit `updateVillageInfo.ts`** — remove `coverImages?: string[];` from `UpdateVillageInfoData`, drop it from the destructure, and delete the `if (coverImages !== undefined) { updates['community.coverImages'] = ... }` block. Narrow the `updates` type to `Record<string, string>` (only description remains).

- [ ] **Step 4: Edit `requestOrganizeVillage.ts`** — remove `coverImages?: string[];` from `RequestOrganizeVillageData`, drop it from the destructure, delete the `const coverImageUrls = ...` line and the `coverImages: coverImageUrls,` field in `newRequest`. Fix the comment at line 40–41 to drop "cover images".

- [ ] **Step 5: Edit `respondToOrganizerRequest.ts:90`** comment — change `description/coverImages/profileForm/activatedAt` to `description/profileForm/activatedAt`.

- [ ] **Step 6: Delete the dead helper.**

```bash
git rm functions/src/helpers/villageCoverImages.ts
```

- [ ] **Step 7: Run functions tests + typecheck.**

```bash
pnpm --filter functions test
pnpm --filter functions typecheck
```
Expected: PASS.

- [ ] **Step 8: Commit.**

```bash
git add functions
git commit -m "refactor(functions): drop coverImages from village write paths; delete dead cover-cleanup helper"
```

### Task 3: Re-source OG preview & event-card cover from the escudo

**Files:**
- Modify: `functions/src/og/fetchers.ts` (lines 43–51, 88–101)
- Modify: `functions/src/village/syncVillageDenormalization.ts` (lines 8–9, 24–33, 64–71)
- Test: `functions/src/__tests__/handlers/og/render.test.ts` + denorm test if present.

This is a behavior change, so TDD: write the new expectation first.

- [ ] **Step 1: Write/extend the OG test.** In `render.test.ts` (or the village-OG unit test), add a case: a municipality with `community` present, **no** `coverImages`, `escudoManualUrl: 'https://x/manual.png'` → `getVillageOg(...).imageUrl === 'https://x/manual.png'`; and with only `escudoUrl` set → falls back to it. Run it; expect FAIL.

- [ ] **Step 2: Edit `getVillageOg`** — delete the `coverImage` line and `coverImages` from `RawVillage`; set `imageUrl: asString(v.escudoManualUrl) ?? asString(v.escudoUrl)`. Remove the now-unused `asStringArray` helper if nothing else uses it (grep first).

- [ ] **Step 3: Write the denorm test.** Assert `pickCover` returns the escudo: an `after` municipality with `escudoManualUrl` set (and no `coverImages`) → `municipalityCoverImage` update equals that URL; and that an escudo-only change (name/coords unchanged) still triggers propagation. Run; expect FAIL.

- [ ] **Step 4: Edit `syncVillageDenormalization.ts`** — replace `pickCover(community)` with a top-level-doc reader that returns `after['escudoManualUrl'] ?? after['escudoUrl'] ?? null` (escudo fields live on the municipality doc, not under `community`). Compute `beforeCover`/`afterCover` from the doc root, and include escudo fields in the change check. Update the header comment.

- [ ] **Step 5: Run functions tests.** `pnpm --filter functions test` — expect PASS.

- [ ] **Step 6: Commit.**

```bash
git add functions
git commit -m "feat(functions): fall back OG preview & event-card cover to the escudo"
```

### Task 4: Mobile — village tab buttons, remove modal, strip cover pickers, i18n

**Files:**
- Modify: `apps/mobile/components/feature/VillageHomeBody.tsx` (imports line 6; header lines 164–178; button row 247–283; modal 396–401; state line 44)
- Delete: `apps/mobile/components/feature/VillageInfoModal.tsx`
- Modify: `apps/mobile/app/(tabs)/__tests__/village.test.tsx` (remove modal mock)
- Modify: `apps/mobile/components/feature/__tests__/VillageHomeBody.test.tsx`
- Modify: `apps/mobile/components/feature/CommunitySettingsEditor.tsx`
- Modify: `apps/mobile/app/village/[villageId]/edit-info.tsx`
- Modify: `apps/mobile/app/discover/start/[municipalityId].tsx`
- Modify: `packages/i18n/messages/es.json`

> Skills: `i18n-add-string` for the string changes; `mobile-web-compat` since this touches `Modal` removal and the share button.

- [ ] **Step 1: i18n.** In `es.json`, add under `village`: `"edit": { "title": "Editar pueblo" }`. Remove keys that become unreferenced after this task: `village.info` (`"Información sobre el pueblo"`), `village.admin.community.images`, `village.admin.community.addImage`, `editInfo.imagesLabel`, `editInfo.addImage`, `start.coversLabel`, `start.addCover`. (After Step 6, grep each removed key to confirm no remaining `t('...')` references.)

- [ ] **Step 2: VillageHomeBody — header & button.** Remove the import of `VillageInfoModal` (line 6). Remove the info-circle `Pressable` (lines 167–173) so the name row is just `<ScreenTitle>`. Remove the `<VillageInfoModal .../>` block (lines 396–401) and the now-unused `infoOpen`/`setInfoOpen` state (line 44). Replace the second button (lines 266–282) so its `onPress`, `accessibilityLabel`, and label switch on `canManage`:
  - admin → `onPress={() => router.push(\`/village/${village.id}/community\` as never)}`, label `t('village.edit.title')`.
  - else → current share behavior + `t('village.share.title')`.

- [ ] **Step 3: Delete the modal + its test mock.**

```bash
git rm apps/mobile/components/feature/VillageInfoModal.tsx
```
In `village.test.tsx`, remove the `jest.mock('.../VillageInfoModal' ...)` / `vi.mock` line and its comment.

- [ ] **Step 4: Update `VillageHomeBody.test.tsx`.** Add/adjust cases: as a non-admin member, the second button shows `Compartir pueblo`; as `canManage`, it shows `Editar pueblo` and pressing it routes to `/village/{id}/community`. Remove any assertions about the info icon / modal opening.

- [ ] **Step 5: Strip cover pickers from the three forms.**
  - `CommunitySettingsEditor.tsx`: remove `images`/`uploading` state, `addImage`, `removeImage`, the `Image` import if unused, the entire images `<Text variant="h3">…images…</Text>` + horizontal `ScrollView` block (lines 147–169), drop `coverImages: images` from the `updateCommunity` call (now `{ description }`), and drop `setImages(...)` from `load`. Remove `uploadMunicipalityImage`'s image usage only if it's no longer used for the escudo (it IS still used by `changeEscudo` — keep it).
  - `edit-info.tsx`: remove `images`/`uploading` state, `addImage`, the images block (lines 82–106), drop `coverImages: images` from the `updateVillageInfo` call (now `{ municipalityId, description }`), and `setImages` from `load`. Remove now-unused imports (`Image`, `pickImageAsBlob`, `uploadMunicipalityImage`, `Ionicons` if unused, `ACCENT` if unused).
  - `discover/start/[municipalityId].tsx`: remove `covers` state, `pickCover`, `PickedCover`, the covers `VStack` block (lines 86–111), the `uploadVillageCoverImage` import, and change the submit to `await startVillage({ municipalityId: id, description: description.trim() })`. Remove now-unused imports (`Image`, `ImagePicker`, `Pressable`, `UploadableImage`).

- [ ] **Step 6: Run mobile checks.**

```bash
pnpm --filter mobile typecheck
pnpm --filter mobile test
rg -n "village.info|coverImages|uploadVillageCoverImage" apps/mobile && echo "STILL REFERENCED" || echo "clean"
```
Expected: PASS and `clean`.

- [ ] **Step 7: Commit.**

```bash
git add apps/mobile packages/i18n
git commit -m "feat(mobile): village tab shows Editar for admins, drop info modal & cover pickers"
```

### Task 5: Seeds, AGENTS note, and in-flight plan docs

**Files:**
- Modify: `scripts/seed/villages.mjs` (lines 29, 48), `scripts/seed/events.mjs:30`, `scripts/seed-village-requests.mjs` (lines 214–264), `scripts/data/seed-fixtures/demo_1/fixtures.mjs`, `scripts/data/seed-fixtures/real_villages_1/fixtures.mjs`
- Modify: `apps/mobile/AGENTS.md:196`
- Modify: `docs/plans/ongoing/og-share-link-previews.md:56`, `docs/plans/ready/pueblo-location-map.md:1018`

- [ ] **Step 1: Seeds.** Remove `coverImages` from the village fixtures and the seed writers: in `villages.mjs` drop the cover-image upload loop and the `coverImages: coverUrls` field; in `events.mjs` change the `villageCover` line to read the escudo (`muni?.escudoManualUrl ?? muni?.escudoUrl ?? null`) or drop it if the seed doesn't need a cover; in `seed-village-requests.mjs` remove the cover upload loop and `coverImages` from the request/community writes; remove `coverImages` arrays from both `fixtures.mjs` files.

- [ ] **Step 2: AGENTS.md.** Edit the image-entity line (196) to drop "village `coverImages` +" so it reads "village escudo" only.

- [ ] **Step 3: Plan docs.** In `og-share-link-previews.md`, change the village-preview image cell to `escudoManualUrl ?? escudoUrl` (drop the `coverImages[0]` term). In `pueblo-location-map.md`, change `updateCommunity(villageId, { description, coverImages: images })` to `updateCommunity(villageId, { description })` and remove any cover-image step in that plan.

- [ ] **Step 4: Verify total removal & commit.**

```bash
rg -n 'coverImages' --glob '!**/node_modules/**' && echo "STILL PRESENT — fix before commit" || echo "fully removed"
git add scripts apps/mobile/AGENTS.md docs/plans
git commit -m "chore: purge coverImages from seeds, AGENTS note, and in-flight plans"
```
Expected: `fully removed`.

### Task 6: Deploy to dev + run the cover-image delete backfill

**Files:**
- Create: `scripts/backfill/delete-cover-images.mjs`

> Skills: `firestore-deploy` (deploy functions) and `firebase-admin-dev` (run the backfill).

- [ ] **Step 1: Deploy the changed functions to dev** via the `firestore-deploy` skill (functions only; dev project `villa-events`). Confirm `syncVillageDenormalization`, `startVillage`, `updateVillageInfo`, `requestOrganizeVillage`, `respondToOrganizerRequest`, and the OG renderer deploy cleanly.

- [ ] **Step 2: Write the backfill.** `scripts/backfill/delete-cover-images.mjs` — using firebase-admin (per `firebase-admin-dev`): for every doc in `municipalities`, if `community.coverImages` exists, `update({ 'community.coverImages': FieldValue.delete() })`; for every doc in the top-level `organizerRequests`, if `coverImages` exists, `update({ coverImages: FieldValue.delete() })`. Batch in chunks of 400; log counts via the script's own console output. Idempotent (skip docs lacking the key).

- [ ] **Step 3: Dry-run then run against dev.** First run with a `--dry-run` flag printing how many docs would change; confirm the count looks sane; then run for real against the dev project. Capture the before/after counts.

- [ ] **Step 4: Verify.** Re-run the backfill — it should report 0 changes (idempotent). Spot-check one municipality doc and one organizerRequest doc in dev to confirm no `coverImages` key remains.

- [ ] **Step 5: Commit.**

```bash
git add scripts/backfill/delete-cover-images.mjs
git commit -m "chore(backfill): delete dangling coverImages key from dev municipalities & organizerRequests"
```

## Self-review

- **Spec coverage:** §1 header/buttons → Task 4; §2 escudo-only → no-op (kept) + verified by Task 4 forms; §3 full removal → Tasks 1,2,4,5; §4 re-sourced fallbacks → Task 3; §5 description kept → Task 4 (forms keep description; only image pickers removed); §6 in-flight plans → Task 5; §7 backfill → Task 6. All covered.
- **Ordering:** shared (1) → functions (2,3) → mobile (4) → seeds/docs (5) → deploy+backfill (6). `pnpm check` may be red between Task 1 and Task 4 because mobile/shared consumers of `coverImages` still reference it; per-package `typecheck`/`test` gate each task, and full `pnpm check` is green after Task 5. Note this to the executor so a mid-plan red check isn't mistaken for a regression.
- **Type consistency:** `updateCommunity` Pick reduced to `'description' | 'adminUserId'` (Task 1) matches its single remaining caller in `CommunitySettingsEditor` passing `{ description }` (Task 4). `uploadVillageCoverImage` deletion (Task 1) matches its only caller's removal (Task 4, discover/start).
