# Festival poster (cartel) — multiple images

## Goal

Let a cartel de fiestas hold multiple images (max 5): the first is the cover shown
on the card, the rest stack vertically below the dates on the detail screen.

## Context

Today the `festivalPoster` entity stores exactly one image:

- **Model** — [FestivalPosterDataModel.ts](../../../packages/shared/src/models/festivalPoster/FestivalPosterDataModel.ts):
  `imageURL: z.string().nullable()`, no array.
- **Storage** — [imageService.ts](../../../packages/shared/src/services/imageService.ts)
  `uploadFestivalPosterImage` uploads to a **fixed** path
  `festivalPosters/{municipalityId}/{posterId}/poster`, so re-upload overwrites the
  single file (no per-image id).
- **Detail** — [festival-poster/[posterId].tsx](../../../apps/mobile/app/village/[villageId]/festival-poster/[posterId].tsx)
  feeds a single `imageUri` into `EntityDetailScaffold` →
  [DetailHeroImage.tsx](../../../apps/mobile/components/feature/DetailHeroImage.tsx).
- **Forms** — create ([FestivalPostersManager.tsx](../../../apps/mobile/components/feature/proposable/FestivalPostersManager.tsx))
  and edit ([edit.tsx](../../../apps/mobile/app/village/[villageId]/festival-poster/[posterId]/edit.tsx))
  hold a single `UploadableImage` (image required).

No carousel or multi-image gallery exists anywhere in the app. News has an
`images[]` array but only ever renders `images[0]`, so it is not a reusable
pattern. This is net-new.

## Design / approach

### Data model — replace scalar with an ordered array

In `FestivalPosterDataModel.ts`, replace `imageURL: string | null` with:

```ts
images: z.array(z.string()).max(5),   // images[0] is the cover; [] allowed only transiently
```

- `images[0]` is the **cover** (used on the card and as the detail hero).
- The remaining entries are the extra images shown below the dates.
- **Max 5.** First image is required by the create form (see below), so a live
  doc always has ≥1; the schema allows `[]` only to keep the builder total.

Rationale:

- **Array-on-doc, not a subcollection** — a poster has a handful of images, never
  hundreds. Keeping them on the doc means the detail screen still reads **one**
  document (no N extra reads) and ordering is just array order. A subcollection
  only earns its cost with per-image metadata (captions/credits), which we don't
  need (YAGNI).
- **Plain URL strings, not `{storagePath}` objects (like news)** — posters already
  store download URLs everywhere; strings keep the change contained and avoid N
  async URL resolutions on read. Tradeoff: a URL breaks if the storage token is
  ever rotated — acceptable, and consistent with today's poster.
- **Drop `imageURL` entirely** — one source of truth, no dual `imageURL` + `images`
  shim (AGENTS.md "delete > deprecate", "no retrocompat shims").

`buildFestivalPosterData` defaults `images` to `input.images ?? []`.
`FestivalPosterDataInput` carries `images?: string[]`.

### Migration (dev backfill)

`images` is a required field and the strict Zod converter throws on any doc missing
it, so existing `villa-events` posters must be backfilled in the same change.

- `scripts/backfill-festivalPoster-images.mjs`, idempotent, project-id guarded,
  mirroring `scripts/backfill-municipality-namelower.mjs`.
- For each poster doc: if it has `imageURL` and no `images`, set
  `images: [imageURL]` and delete `imageURL` (`FieldValue.delete()`); skip docs
  already migrated.
- Verify with `pnpm check:dev-conformance` before and after.
- Autonomous on dev per AGENTS.md; beta/prod out of scope for this change.

### Storage — per-image ids

`uploadFestivalPosterImage` moves from the fixed `…/{posterId}/poster` path to a
per-image path `…/{posterId}/{imageId}` (via the existing `generateImageId`), so
multiple images coexist instead of overwriting. Each upload returns its download
URL, appended to `images`.

### Detail screen — hero + vertical stack (no carousel)

Per the clarified UX, this is **not** a horizontal carousel:

- Hero unchanged: `images[0]` → existing `DetailHeroImage`.
- Below title + dates + body, a **vertical stack** of the remaining images
  (`images.slice(1)`), each a full-width `NaturalImage`, inside the scaffold's
  existing vertical `ScrollView`. User simply scrolls down.
- Add an optional below-content slot to
  [EntityDetailScaffold.tsx](../../../apps/mobile/components/feature/EntityDetailScaffold.tsx)
  (e.g. `belowContent?: ReactNode`) rather than hand-rolling it in the screen, so
  other entities can reuse it later.

### Create / edit forms — squared thumbnail row with trailing "+"

Move from a single `UploadableImage` to an ordered list (max 5), rendered as a
**horizontal row of squared thumbnails**:

- Empty state: one squared "add" button (the cover).
- After the first pick: the square shows the preview and a squared **"+"** button
  appears to its right to add the next image.
- Keep adding until 5 images, then the "+" square disappears.
- Each thumbnail is removable; the first is the cover.
- Each new pick uploads immediately (`pickImageAsBlob` → `uploadFestivalPosterImage`)
  and appends its URL.
- Create still **requires the first image** (cover); extras optional.

### Also touched (because `imageURL` goes away)

- Poster **card** (and any other `imageURL` reader) → `images[0]`.
- `updateFestivalPoster` patch `Pick` swaps `imageURL` → `images`.
- Both Zod converters validate the new schema automatically (no code change beyond
  the schema).
- Model builder / service vitest tests updated.

### Tests

- `packages/shared/test/` (vitest): `buildFestivalPosterData` defaults and `max(5)`
  enforcement; `images[0]` as cover; `updateFestivalPoster` patch shape.
- Form multi-image UI is RN-only; note in the PR if not unit-testable.

## Out of scope (deliberately, YAGNI)

- Fullscreen / pinch-zoom lightbox.
- Per-image captions, credits, or a `gallery` subcollection.
- Horizontal swipe carousel (the chosen UX is a vertical stack).
- Beta/prod backfill (dev only for this change).

## Open questions

- None outstanding. (Max = 5; cover = `images[0]`; drop `imageURL`; vertical stack,
  not carousel — all confirmed.)
