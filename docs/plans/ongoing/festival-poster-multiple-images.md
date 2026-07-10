# Festival poster (cartel) — multiple images

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

## Goal

Let a cartel de fiestas hold multiple images (max 5): the first is the cover shown
on the card, the rest stack vertically below the dates on the detail screen.

## Status

- **Updated:** 2026-07-10
- **Stage:** Task 1 — model + service migration
- **Branch:** repo `feat/festival-poster-multiple-images` (worktree `.claude/worktrees/poster-multi-images`)
- **Done:** design doc; worktree + deps
- **Next:** Task 1 (replace `imageURL` with `images: string[]` in model + service)
- **Blockers:** none
- **Handoff:** dev backfill (Task 9) needs `GOOGLE_APPLICATION_CREDENTIALS` for `villa-events` (see `firebase-admin-dev` skill); run `pnpm check:dev-conformance` before/after. Storage rules already allow a `{fileName}` wildcard under `festivalPosters/{muni}/{posterId}/`, so per-image ids need **no** rules change.

## Global constraints

- Strict TS, no `any`, no `@ts-nocheck` (AGENTS.md §5).
- No Firebase SDK imports outside `packages/shared/src/services/` — route through services.
- Max **5** images; `images[0]` is the cover.
- User-facing strings go through `useT()` / `packages/i18n/messages/es.json`.
- No retrocompat shim: drop `imageURL` entirely, backfill dev in the same change.
- Commit per task (conventional commits, ≤100 char header).

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

## File structure

**Create**
- `apps/mobile/components/feature/MultiImagePickerRow.tsx` — presentational row of squared thumbnails + trailing "+", reused by both forms.
- `scripts/backfill-festivalPoster-images.mjs` — dev migration `imageURL` → `images`.

**Modify**
- `packages/shared/src/models/festivalPoster/FestivalPosterDataModel.ts` — schema/input/builder.
- `packages/shared/test/models/festivalPoster/FestivalPosterDataModel.test.ts` — expectations.
- `packages/shared/src/services/festivalPosterService.ts` — `updateFestivalPoster` Pick.
- `packages/shared/src/services/imageService.ts` — per-image upload path.
- `apps/mobile/components/feature/EntityDetailScaffold.tsx` — `belowContent` slot.
- `apps/mobile/app/village/[villageId]/festival-poster/[posterId].tsx` — hero = `images[0]`, extras below.
- `apps/mobile/app/village/[villageId]/festival-poster/__tests__/posterId.test.tsx` — mock `images`.
- `apps/mobile/components/feature/proposable/FestivalPostersManager.tsx` — multi-image create.
- `apps/mobile/components/feature/proposable/__tests__/FestivalPostersManager.test.tsx` — mock/expect `images`.
- `apps/mobile/app/village/[villageId]/festival-poster/[posterId]/edit.tsx` — multi-image edit.
- `apps/mobile/app/village/[villageId]/festival-poster/__tests__/edit.test.tsx` — mock `images`.
- `apps/mobile/components/feature/VillageHomeBody.tsx` — poster card `imageUri={p.images[0] ?? null}`.
- `packages/i18n/messages/es.json` — `festivalPosters.form` add/remove labels.
- `packages/shared/src/services/_services-map.md` + `CHANGELOG.md` — docs.

**No change needed:** `storage.rules` (existing `{fileName}` wildcard covers per-image ids); both converters (auto-validate the new schema).

---

### Task 1: Model + service — replace `imageURL` with `images: string[]`

**Files:**
- Modify: `packages/shared/src/models/festivalPoster/FestivalPosterDataModel.ts`
- Modify: `packages/shared/src/services/festivalPosterService.ts:58-65`
- Test: `packages/shared/test/models/festivalPoster/FestivalPosterDataModel.test.ts`

**Interfaces:**
- Produces: `FestivalPosterData.images: string[]` (max 5), `FestivalPosterDataInput.images?: string[]`, `buildFestivalPosterData` defaults `images` to `[]`. `imageURL` no longer exists.
- Consumed by: Tasks 3, 6, 7, 8 (`poster.images`), Task 2 (upload), Task 9 (backfill target field).

- [ ] **Step 1: Update the failing test.** In `FestivalPosterDataModel.test.ts`, replace the `imageURL` assertion (line 25) and add coverage:

```ts
// in the first `it(...)` block, replace `expect(d.imageURL).toBeNull();` with:
    expect(d.images).toEqual([]);
```

Add two new cases inside `describe('buildFestivalPosterData', ...)`:

```ts
  it('defaults images to [] and keeps provided images ordered (cover first)', () => {
    const d = buildFestivalPosterData({ ...base, images: ['a', 'b', 'c'] });
    expect(d.images).toEqual(['a', 'b', 'c']);
    expect(() => FestivalPosterDataSchema.parse(d)).not.toThrow();
  });

  it('rejects more than 5 images at the schema boundary', () => {
    const d = buildFestivalPosterData({ ...base });
    expect(() => FestivalPosterDataSchema.parse({ ...d, images: ['1', '2', '3', '4', '5', '6'] })).toThrow();
  });
```

- [ ] **Step 2: Run the test, watch it fail.**

Run: `pnpm --filter @cultuvilla/shared test -- FestivalPosterDataModel`
Expected: FAIL (`d.images` undefined; `imageURL` gone).

- [ ] **Step 3: Change the model.** In `FestivalPosterDataModel.ts`:

Schema — replace line 14 `imageURL: z.string().nullable(),` with:
```ts
  images: z.array(z.string()).max(5),
```
Input interface — replace line 28 `imageURL?: string | null;` with:
```ts
  images?: string[];
```
Builder — replace line 48 `imageURL: input.imageURL ?? null,` with:
```ts
    images: input.images ?? [],
```

- [ ] **Step 4: Change the service.** In `festivalPosterService.ts`, `updateFestivalPoster` (lines 58-65) — swap `'imageURL'` for `'images'` in the `Pick`:

```ts
export function updateFestivalPoster(
  posterId: string,
  patch: Partial<
    Pick<FestivalPosterData, 'year' | 'title' | 'images' | 'datePrecision' | 'startsAt' | 'endsAt'>
  >,
): Promise<void> {
  return updateDoc(doc(getDb(), 'festivalPosters', posterId), patch);
}
```

- [ ] **Step 5: Run tests + typecheck.**

Run: `pnpm --filter @cultuvilla/shared test -- FestivalPosterDataModel && pnpm --filter @cultuvilla/shared typecheck`
Expected: PASS. (Mobile typecheck will still fail — fixed in Tasks 3/6/7/8.)

- [ ] **Step 6: Commit.**

```bash
git add packages/shared/src/models/festivalPoster/FestivalPosterDataModel.ts \
        packages/shared/src/services/festivalPosterService.ts \
        packages/shared/test/models/festivalPoster/FestivalPosterDataModel.test.ts
git commit -m "feat(festival-poster): model images[] replacing scalar imageURL"
```

---

### Task 2: Storage — per-image upload path

**Files:**
- Modify: `packages/shared/src/services/imageService.ts:158-164`

**Interfaces:**
- Consumes: `generateImageId` (already in this file, line 26).
- Produces: `uploadFestivalPosterImage(municipalityId, posterId, image)` still returns a download URL, now written to a unique per-image path so images don't overwrite.

- [ ] **Step 1: Change the path.** Replace the body of `uploadFestivalPosterImage` (line 163):

```ts
export async function uploadFestivalPosterImage(
  municipalityId: string,
  posterId: string,
  image: UploadableImage,
): Promise<string> {
  return uploadToPath(
    `festivalPosters/${municipalityId}/${posterId}/${generateImageId(image.filename)}`,
    image,
  );
}
```

Also update the JSDoc above it (line 155-156): change `FestivalPosterData.imageURL` → `FestivalPosterData.images[]`.

- [ ] **Step 2: Typecheck.**

Run: `pnpm --filter @cultuvilla/shared typecheck`
Expected: PASS. (No unit test: the function only wraps Firebase Storage + `generateImageId`, which uses `Date.now`/`Math.random`; exercised manually via `/verify` in Task 9.)

- [ ] **Step 3: Commit.**

```bash
git add packages/shared/src/services/imageService.ts
git commit -m "feat(festival-poster): upload each poster image to a unique path"
```

---

### Task 3: Detail screen — hero cover + extra images below

**Files:**
- Modify: `apps/mobile/components/feature/EntityDetailScaffold.tsx`
- Modify: `apps/mobile/app/village/[villageId]/festival-poster/[posterId].tsx`
- Test: `apps/mobile/app/village/[villageId]/festival-poster/__tests__/posterId.test.tsx:18`

**Interfaces:**
- Consumes: `FestivalPosterWithId.images` (Task 1).
- Produces: `EntityDetailScaffold` gains `belowContent?: ReactNode`, rendered full-bleed after the padded `VStack`, inside the scroll view.

- [ ] **Step 1: Fix the test mock (RED).** In `posterId.test.tsx`, line 18, change the mock to the new shape and add a second image:

```ts
  getFestivalPoster: jest.fn().mockResolvedValue({ id: 'p1', title: 'Fiestas 2026', year: 2026, images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'], startsAt: null, endsAt: null }),
```

- [ ] **Step 2: Run it, watch it fail.**

Run: `pnpm app:test -- posterId`
Expected: FAIL (screen still reads `poster.imageURL`).

- [ ] **Step 3: Add the `belowContent` slot to the scaffold.** In `EntityDetailScaffold.tsx`:

Add to `EntityDetailScaffoldProps` (after `children?: ReactNode;`, line 30):
```ts
  /** Full-bleed content rendered after the padded body (e.g. extra images). */
  belowContent?: ReactNode;
```
Add `belowContent,` to the destructured params (after `children,`, line 46). Then render it after the `VStack`, still inside the `ScrollView` (after line 74 `</VStack>`):
```tsx
            </VStack>
            {belowContent}
```

- [ ] **Step 4: Wire the poster detail screen.** In `[posterId].tsx`:

Add imports:
```tsx
import { VStack } from '../../../../components/primitives/VStack';
import { NaturalImage } from '../../../../components/primitives/NaturalImage';
```
Replace `imageUri={poster?.imageURL ?? null}` (line 56) with:
```tsx
      imageUri={poster?.images[0] ?? null}
```
Add the `belowContent` prop to `<EntityDetailScaffold>` (alongside the other props):
```tsx
      belowContent={
        poster && poster.images.length > 1 ? (
          <VStack gap={2} className="pt-2">
            {poster.images.slice(1).map((uri) => (
              <NaturalImage key={uri} uri={uri} />
            ))}
          </VStack>
        ) : undefined
      }
```

- [ ] **Step 5: Run test + mobile typecheck.**

Run: `pnpm app:test -- posterId && pnpm app:typecheck`
Expected: `posterId` PASS. (`app:typecheck` still fails on the forms/card — Tasks 6/7/8.)

- [ ] **Step 6: Commit.**

```bash
git add apps/mobile/components/feature/EntityDetailScaffold.tsx \
        apps/mobile/app/village/[villageId]/festival-poster/[posterId].tsx \
        apps/mobile/app/village/[villageId]/festival-poster/__tests__/posterId.test.tsx
git commit -m "feat(festival-poster): show extra poster images below dates on detail"
```

---

### Task 4: i18n — add/remove image labels

**Files:**
- Modify: `packages/i18n/messages/es.json:426-433`

**Interfaces:**
- Produces: `village.festivalPosters.form.addImage`, `village.festivalPosters.form.removeImage` (consumed by Tasks 5/6/7).

- [ ] **Step 1: Add the keys.** In the `festivalPosters.form` object (lines 426-433), add:

```json
        "image": "Cartel",
        "addImage": "Añadir imagen",
        "removeImage": "Quitar imagen"
```
(Insert the two new keys after the existing `"image": "Cartel"` line; keep valid JSON — add the comma after `"Cartel"`.)

- [ ] **Step 2: Typecheck i18n + shared.**

Run: `pnpm --filter @cultuvilla/i18n typecheck`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add packages/i18n/messages/es.json
git commit -m "feat(i18n): festival poster add/remove image labels"
```

---

### Task 5: `MultiImagePickerRow` component

**Files:**
- Create: `apps/mobile/components/feature/MultiImagePickerRow.tsx`

**Interfaces:**
- Consumes: `ImagePickerField` primitive, `Pressable`, `Ionicons`, `iconSizes` (design-system), `spacing`.
- Produces: `MultiImagePickerRow` with props:
  ```ts
  { uris: string[]; onAddPress: () => void; onRemove: (index: number) => void;
    max?: number; adding?: boolean; addLabel: string; removeLabel: string; }
  ```
  Presentational only — the parent owns picking/uploading/state. Renders each `uri` as a squared thumbnail with a small "×" remove overlay, plus a trailing dashed "+" square when `uris.length < max` (default 5), in a horizontal scroll.

- [ ] **Step 1: Write the component.**

```tsx
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, iconSizes, spacing } from '@cultuvilla/shared/design-system';
import { ImagePickerField } from '../primitives/ImagePickerField';
import { Pressable } from '../primitives/Pressable';

const THUMB = 96;

export type MultiImagePickerRowProps = {
  uris: string[];
  onAddPress: () => void;
  onRemove: (index: number) => void;
  max?: number;
  adding?: boolean;
  addLabel: string;
  removeLabel: string;
};

/**
 * Horizontal row of squared image thumbnails with a trailing dashed "+" square
 * (the "add" affordance appears to the right of the picked images and disappears
 * at `max`). Purely presentational: the parent handles pick/upload/remove state.
 * The first thumbnail is the cover by convention.
 */
export function MultiImagePickerRow({
  uris,
  onAddPress,
  onRemove,
  max = 5,
  adding = false,
  addLabel,
  removeLabel,
}: MultiImagePickerRowProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        {uris.map((uri, i) => (
          <View key={uri} style={{ width: THUMB, height: THUMB }}>
            <ImagePickerField uri={uri} onPress={() => {}} label={uri} size={THUMB} />
            <Pressable
              onPress={() => onRemove(i)}
              accessibilityLabel={removeLabel}
              className="absolute rounded-full bg-black/60 items-center justify-center"
              style={{ top: 4, right: 4, width: 24, height: 24 }}
            >
              <Ionicons name="close" size={iconSizes.sm} color={colors.light.fg.inverse} />
            </Pressable>
          </View>
        ))}
        {uris.length < max ? (
          <ImagePickerField
            uri={null}
            onPress={onAddPress}
            label={addLabel}
            size={THUMB}
            loading={adding}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Typecheck.** (Verify the design-system exports used exist.)

Run: `node -e "const d=require('./packages/shared/src/design-system'); console.log(!!d.colors.light.fg.inverse, !!d.iconSizes.sm, !!d.spacing[2])"` — if any is `false`, substitute the nearest token (e.g. `colors.light.fg.onAccent`, a literal `'#fff'` only as a last resort) and note it. Then `pnpm app:typecheck` (will still fail on forms until Tasks 6/7).

- [ ] **Step 3: Commit.**

```bash
git add apps/mobile/components/feature/MultiImagePickerRow.tsx
git commit -m "feat(festival-poster): add MultiImagePickerRow component"
```

---

### Task 6: Create form — multiple images

**Files:**
- Modify: `apps/mobile/components/feature/proposable/FestivalPostersManager.tsx`
- Test: `apps/mobile/components/feature/proposable/__tests__/FestivalPostersManager.test.tsx:47`

**Interfaces:**
- Consumes: `MultiImagePickerRow` (Task 5), `uploadFestivalPosterImage` (Task 2), `createFestivalPoster`/`newFestivalPosterId` (Task 1), `deleteImageByURL` (imageService).

- [ ] **Step 1: Update the test (RED).** In `FestivalPostersManager.test.tsx`, the create assertion (around line 47) currently expects `imageURL: 'https://example.com/poster.jpg'`. Change it to expect the array:

```ts
          images: ['https://example.com/poster.jpg'],
```
(Keep the rest of the expected payload. The test drives one image pick; if it asserts the uploaded arg, leave that as-is — the mock upload still returns the single URL.)

- [ ] **Step 2: Run it, watch it fail.**

Run: `pnpm app:test -- FestivalPostersManager`
Expected: FAIL (payload still sends `imageURL`).

- [ ] **Step 3: Rewrite the form's image handling.** In `FestivalPostersManager.tsx`:

Replace the `image` state (line 34) with an id minted up front + an image-URL list + an in-flight flag:
```ts
  const [posterId] = useState(newFestivalPosterId);
  const [images, setImages] = useState<string[]>([]);
  const [addingImage, setAddingImage] = useState(false);
```
Add an add-handler (upload on pick, append URL):
```ts
  async function addImage() {
    const picked = await pickImageAsBlob();
    if (!picked) return;
    setAddingImage(true);
    try {
      const url = await uploadFestivalPosterImage(villageId, posterId, picked);
      setImages((prev) => [...prev, url]);
    } finally {
      setAddingImage(false);
    }
  }

  function removeImage(index: number) {
    const url = images[index];
    setImages((prev) => prev.filter((_, i) => i !== index));
    void deleteImageByURL(url).catch(() => {}); // best-effort orphan cleanup
  }
```
In `submit`, use the pre-minted `posterId` and the collected `images` (no upload here anymore):
```ts
  async function submit() {
    const y = parseInt(year, 10);
    if (!villageId || !uid || !Number.isInteger(y) || images.length === 0) return;
    setSaving(true);
    try {
      const payload = {
        municipalityId: villageId,
        proposedBy: uid,
        year: y,
        title: title.trim() || null,
        images,
        ...datesToPayload(startsAt, endsAt),
        createdAt: new Date(),
      };
      await createFestivalPoster(payload, posterId);
      setYear(String(new Date().getFullYear()));
      setTitle('');
      setStartsAt(null);
      setEndsAt(null);
      setImages([]);
      onCreated?.();
    } finally {
      setSaving(false);
    }
  }
```
Replace the `ImagePickerField` block (lines 70-77) with the row:
```tsx
        <MultiImagePickerRow
          uris={images}
          onAddPress={addImage}
          onRemove={removeImage}
          adding={addingImage}
          addLabel={t('village.festivalPosters.form.addImage')}
          removeLabel={t('village.festivalPosters.form.removeImage')}
        />
```
Update the submit `disabled` (line 113): `disabled={!Number.isInteger(y) || images.length === 0}`.
Fix imports: drop `ImagePickerField` from the primitives import, drop the now-unused `UploadableImage` type import, add:
```ts
import { deleteImageByURL, uploadFestivalPosterImage } from '@cultuvilla/shared/services/imageService';
import { MultiImagePickerRow } from '../MultiImagePickerRow';
```

- [ ] **Step 4: Run test + typecheck.**

Run: `pnpm app:test -- FestivalPostersManager && pnpm app:typecheck`
Expected: `FestivalPostersManager` PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/mobile/components/feature/proposable/FestivalPostersManager.tsx \
        apps/mobile/components/feature/proposable/__tests__/FestivalPostersManager.test.tsx
git commit -m "feat(festival-poster): create form supports up to 5 images"
```

---

### Task 7: Edit form — multiple images

**Files:**
- Modify: `apps/mobile/app/village/[villageId]/festival-poster/[posterId]/edit.tsx`
- Test: `apps/mobile/app/village/[villageId]/festival-poster/__tests__/edit.test.tsx:22`

**Interfaces:**
- Consumes: `MultiImagePickerRow` (Task 5), `updateFestivalPoster` (Task 1), `uploadFestivalPosterImage`/`deleteImageByURL` (Task 2).

- [ ] **Step 1: Update the test mock (RED).** In `edit.test.tsx`, line 22, change `imageURL: null,` to:

```ts
    images: [],
```

- [ ] **Step 2: Run it, watch it fail.**

Run: `pnpm app:test -- festival-poster/__tests__/edit`
Expected: FAIL (screen reads `p.imageURL`).

- [ ] **Step 3: Rewrite the edit form's image handling.** In `edit.tsx`:

Replace the `existingImageUri` + `image` state (lines 35-36) with:
```ts
  const [images, setImages] = useState<string[]>([]);
  const [addingImage, setAddingImage] = useState(false);
```
In the loader (line 50), replace `setExistingImageUri(p.imageURL ?? null);` with:
```ts
        setImages(p.images);
```
Add handlers (above `submit`):
```ts
  async function addImage() {
    if (!villageId || !posterId) return;
    const picked = await pickImageAsBlob();
    if (!picked) return;
    setAddingImage(true);
    try {
      const url = await uploadFestivalPosterImage(villageId, posterId, picked);
      setImages((prev) => [...prev, url]);
    } finally {
      setAddingImage(false);
    }
  }

  function removeImage(index: number) {
    const url = images[index];
    setImages((prev) => prev.filter((_, i) => i !== index));
    void deleteImageByURL(url).catch(() => {});
  }
```
Rewrite `submit` to persist `images` and require at least one:
```ts
  async function submit() {
    if (!posterId || !villageId || !Number.isInteger(yearNum) || images.length === 0) return;
    setSaving(true);
    try {
      await updateFestivalPoster(posterId, {
        year: yearNum,
        title: title.trim() || null,
        images,
        ...datesToPayload(startsAt, endsAt),
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }
```
Replace the `ImagePickerField` block (lines 120-127) with:
```tsx
              <MultiImagePickerRow
                uris={images}
                onAddPress={addImage}
                onRemove={removeImage}
                adding={addingImage}
                addLabel={t('village.festivalPosters.form.addImage')}
                removeLabel={t('village.festivalPosters.form.removeImage')}
              />
```
Update submit `disabled` (line 157): `disabled={!Number.isInteger(yearNum) || images.length === 0}`.
Fix imports: drop the `ImagePickerField` import (line 11) and the `UploadableImage` type import (line 24); add `deleteImageByURL` to the imageService import (line 23) and:
```ts
import { MultiImagePickerRow } from '../../../../../components/feature/MultiImagePickerRow';
```

- [ ] **Step 4: Run test + typecheck.**

Run: `pnpm app:test -- festival-poster/__tests__/edit && pnpm app:typecheck`
Expected: `edit` PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/mobile/app/village/[villageId]/festival-poster/[posterId]/edit.tsx \
        apps/mobile/app/village/[villageId]/festival-poster/__tests__/edit.test.tsx
git commit -m "feat(festival-poster): edit form supports up to 5 images"
```

---

### Task 8: Poster card reader → `images[0]`

**Files:**
- Modify: `apps/mobile/components/feature/VillageHomeBody.tsx:369`

**Interfaces:**
- Consumes: `FestivalPosterWithId.images` (Task 1).

- [ ] **Step 1: Update the card image.** At line 369, change `imageUri={p.imageURL}` to:

```tsx
              imageUri={p.images[0] ?? null}
```

- [ ] **Step 2: Full mobile typecheck + test (no more `imageURL` readers should remain).**

Run: `grep -rn "\.imageURL" apps/mobile --include=*.tsx | grep -i poster` → expect no non-test hits, then `pnpm app:typecheck && pnpm app:test`
Expected: PASS (whole mobile suite green).

- [ ] **Step 3: Commit.**

```bash
git add apps/mobile/components/feature/VillageHomeBody.tsx
git commit -m "feat(festival-poster): poster card uses first image as cover"
```

---

### Task 9: Dev backfill + docs + full gate

**Files:**
- Create: `scripts/backfill-festivalPoster-images.mjs`
- Modify: `packages/shared/src/services/_services-map.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: the new `images` field (Task 1). Migrates dev `villa-events` docs.

- [ ] **Step 1: Write the backfill script** (mirror `backfill-municipality-namelower.mjs`):

```js
#!/usr/bin/env node
/**
 * backfill-festivalPoster-images.mjs
 *
 * One-off: migrate dev festivalPoster docs from the scalar `imageURL` to the
 * ordered `images: string[]` array. For each doc that still has `imageURL`, set
 * `images: [imageURL]` (or `[]` if null) and delete `imageURL`.
 *
 * USAGE: node scripts/backfill-festivalPoster-images.mjs
 * Idempotent: docs already migrated (no `imageURL` field) are skipped.
 */
import admin from 'firebase-admin';

const PROJECT_ID = 'villa-events';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS is not set.');
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

if (admin.app().options.projectId !== PROJECT_ID) {
  console.error(`Refusing to run against ${admin.app().options.projectId} — dev only.`);
  process.exit(1);
}

async function main() {
  const snap = await db.collection('festivalPosters').get();
  console.log(`Loaded ${snap.size} festivalPoster docs.`);

  let patched = 0;
  let skipped = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (!('imageURL' in data)) { skipped++; continue; } // already migrated
    const images = typeof data.imageURL === 'string' ? [data.imageURL] : [];
    batch.update(docSnap.ref, { images, imageURL: admin.firestore.FieldValue.delete() });
    patched++;
    inBatch++;
    if (inBatch >= 400) { await batch.commit(); batch = db.batch(); inBatch = 0; }
  }
  if (inBatch > 0) await batch.commit();

  console.log(`\nDone. Patched: ${patched}  Already migrated: ${skipped}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Check conformance (before), run backfill, check again (after).**

Run:
```bash
pnpm check:dev-conformance   # expect festivalPosters flagged nonconforming (missing images)
node scripts/backfill-festivalPoster-images.mjs
pnpm check:dev-conformance   # expect festivalPosters clean
```
(Needs dev creds — see `firebase-admin-dev` skill. Autonomous on dev per AGENTS.md.)

- [ ] **Step 3: Update docs.** In `_services-map.md`, update the `festivalPosterService` / `festivalPosters` entry to say images are stored as `images: string[]` (cover = `images[0]`). In `CHANGELOG.md` under `## [Unreleased]`, add:
```md
- Carteles de fiestas ahora admiten varias imágenes (máx. 5); la primera es la portada.
```

- [ ] **Step 4: Full gate.**

Run: `pnpm check`
Expected: PASS (lint + typecheck + test + build).

- [ ] **Step 5: Commit.**

```bash
git add scripts/backfill-festivalPoster-images.mjs \
        packages/shared/src/services/_services-map.md CHANGELOG.md
git commit -m "chore(festival-poster): backfill dev images[], update docs"
```

---

## Self-review

- **Spec coverage:** data model → Task 1; migration → Task 9; storage → Task 2; detail hero+stack → Task 3; forms (thumbnail row + trailing "+") → Tasks 5–7; card + other `imageURL` readers → Task 8; tests → Tasks 1/3/6/7; docs → Task 9. ✅
- **Placeholder scan:** none. Every code step shows the code.
- **Type consistency:** `images: string[]` and `poster.images[0] ?? null` used consistently; `MultiImagePickerRow` prop names match across Tasks 5–7.
- **YAGNI:** no lightbox, no captions, no subcollection, no swipe carousel (matches confirmed UX).
