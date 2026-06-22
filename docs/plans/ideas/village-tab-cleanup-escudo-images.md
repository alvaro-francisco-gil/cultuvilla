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

## Open questions

- **Strict-converter compatibility:** removing `coverImages` from a schema that is read through a strict zod converter could throw on legacy Firestore docs that still carry the key. During implementation, confirm the converter mode for `MunicipalityData` / `VillageCommunity` and `OrganizerRequestData` (strip vs `.strict()`). If strict, either keep tolerating/stripping the legacy key or plan a one-time read-side strip. (The municipality collection is noted as not yet schema-first, so its reads may be raw — verify.)
- Whether existing Firestore docs need a backfill to delete the dangling `coverImages` key, or whether leaving it (ignored on read) is acceptable. Leaning: leave it; it's harmless once unread.
