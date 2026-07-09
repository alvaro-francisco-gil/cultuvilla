# Carteles de fiestas

## Goal

Add a per-village visual archive of fiesta posters ("carteles de fiestas"), one card per year, surfaced as a new horizontal scroll on the village screen.

## Context

Spanish villages print an annual poster (cartel) for their fiestas patronales. Residents want to browse these year by year — the poster artwork itself is the artifact of interest, with the **year** as the primary, prominent label and the fiesta dates as secondary context. There is no equivalent surface today; the village screen has scrolls for people, barrios, places, orgs/peñas, and news, but nothing for this cultural archive.

Scope decision: a cartel is **a poster image + metadata only** (a visual archive), *not* a container that links to events and *not* a rich-content post. Tapping a card opens the poster full-screen.

## Design / approach

### Data model

New first-class **top-level collection `festivalPosters/`**, scoped by `municipalityId` (architecture invariant #3), read through a new `festivalPosterService`. Model under `packages/shared/src/models/festivalPoster/`, mirroring the **place** proposable shape (`PlaceData` in `MunicipalityDataModel.ts`) — download-URL image, `proposedBy`, and the shared `reviewDecisionFields` mixin:

```
municipalityId: string
proposedBy: string | null          // uid of the villager who proposed it (null for admin-seeded)
year: number                       // required — the big, visible label
title: string | null               // optional patronal name ("San Roque", "El Cristo")
imageURL: string | null            // download URL (place/org style); null only during create→upload window
datePrecision: 'year' | 'month' | 'day'
startsAt: Date | null              // null when precision === 'year'
endsAt: Date | null                // null for single-day or year-only
createdAt: Date
...reviewDecisionFields            // status: 'pending'|'approved'|'rejected', reviewedBy, reviewedAt
```

**Progressive date precision.** `year` is always present and is the anchor. The optional range carries a `datePrecision` flag telling the UI how to format:

- `year` → the card shows only the big year, no secondary date line
- `month` → "Agosto 2025"
- `day` → "14 de Agosto – 18 de Agosto 2025"

A single range covers all three cases. Multiple disjoint blocks and time-of-day are explicitly **out of scope**. To avoid a native date-picker dependency (which behaves badly on the web build), the v1 proposal form models a range **within a single month**: precision chips (Solo año / Mes / Días), a month chip row, and start/end day steppers (1–31). The model, formatter, and card render all three precisions regardless of how the doc was created.

### Presentation (village screen)

A new **"Carteles de fiestas"** section on the shared village tab, using the existing `Section` + horizontal `ScrollView` pattern in `apps/mobile/components/feature/VillageSections.tsx`.

Existing cards are square (`175×175`). A printed cartel is **portrait** (~A3), so a new **portrait card variant** (`140×198`) reuses the same full-bleed-image + bottom-scrim treatment:

- Full-bleed poster image, `resizeMode="cover"`.
- Bottom scrim: **year** large + bold; `title` beneath when present; a third muted line for the formatted date range (omitted for `year` precision).
- Ordered by `year` descending.
- Trailing portrait `PosterAddCard` for the propose/add affordance ("Proponer"/"Añadir"), consistent with the other scrolls.
- Tap → **full-screen poster viewer** (raw image, `resizeMode="contain"`, close button). Pinch/zoom is out of scope for v1.

### Moderation, service & uploads

**Propose → approve flow, rules-only approval** (the *place* variant — chosen because a poster approve only flips `status`; no cross-user side effect requires a callable):

- Villagers propose via `festivalPosterService.proposeFestivalPoster(...)` → doc with `status: 'pending'`, `proposedBy: uid`.
- Village admins approve/reject through the shared manager surface (`VillageContentManager.tsx`) via `approveFestivalPoster` / `rejectFestivalPoster` — plain client `updateDoc`s, authorised entirely by `firestore.rules` (an admin's `allow update` is unconstrained on `status`; a non-admin proposer is pinned to `status == 'pending'`).
- **Image upload:** mint the id first (`newFestivalPosterId`), upload via `imageService.uploadFestivalPosterImage(municipalityId, id, blob)` → download URL, then create the doc with `imageURL` set. `pickImageAsBlob` → `imageService`; never import `firebase/storage` in mobile screens.

## Resolved decisions

- **Approval mechanism:** rules-only (place variant), *not* a Cloud Function callable. Confirmed against `firestore.rules` `match /places/{placeId}` and `municipalityService.approvePlace` (plain `updateDoc`). No `functions/` change needed.
- **Full-screen viewer:** no reusable viewer exists in the app. Build a minimal web-safe overlay (absolute-positioned `View`, **not** RN `Modal` — see `mobile-web-compat`), not a new navigation route.
- **Image storage convention:** download URL + no width/height (place/org style), not storagePath+dims (news style). The fixed portrait card uses `cover`, so aspect ratio isn't needed.

---

## Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Also invoke `add-firestore-collection` (Tasks 1–5) for the multi-file checklist.

**Goal:** Ship a per-village year-by-year fiesta-poster archive as a new horizontal scroll, with a propose→approve moderation flow mirroring places.

**Architecture:** New top-level `festivalPosters/` collection (Zod model + strict converter + service), rules-only admin approval, a portrait card variant + full-screen overlay on the village tab, and a per-type proposable manager mirroring `PlacesManager`.

**Tech Stack:** TypeScript (strict), Zod, Firebase (Firestore + Storage) via the service layer, Expo/React Native + NativeWind, vitest (shared) + `@firebase/rules-unit-testing` (e2e) + jest (mobile).

### Global Constraints

- Components/hooks/screens **must not** import `firebase/firestore|storage`; route through services (invariant #1).
- Top-level collection carrying `municipalityId` (invariant #3); add the composite index in the same change.
- `strict: true`, no `any`, no `@ts-nocheck`.
- User-facing strings via `useT()` / `packages/i18n/messages/es.json`; formatting via `@cultuvilla/shared` `formatDate`, never raw `Intl` in screens.
- No RN `Modal` / `Alert.alert` / `Picker` in new mobile UI (web-build compat) — use overlays + chip rows.
- Compose primitives (`Screen`, `HStack`, `VStack`, `Text`, `Pressable`, `Button`, `Input`, `Card`) before dropping to raw `<View>`.
- Conventional commits; commit at the end of each task.

---

### Task 1: FestivalPoster model + builder

**Files:**
- Create: `packages/shared/src/models/festivalPoster/FestivalPosterDataModel.ts`
- Create: `packages/shared/src/models/festivalPoster/index.ts`
- Modify: `packages/shared/src/models/index.ts` (add barrel line)
- Test: `packages/shared/test/models/festivalPoster/FestivalPosterDataModel.test.ts`

**Interfaces:**
- Produces: `FestivalPosterDataSchema`, `FestivalPosterData`, `FestivalPosterDataInput`, `buildFestivalPosterData(input): FestivalPosterData`, `DatePrecision`, `DatePrecisionSchema`, `DATE_PRECISIONS`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/test/models/festivalPoster/FestivalPosterDataModel.test.ts
import { describe, it, expect } from 'vitest';
import {
  FestivalPosterDataSchema,
  buildFestivalPosterData,
} from '../../../src/models/festivalPoster/FestivalPosterDataModel';

const base = {
  municipalityId: 'm1',
  year: 2025,
  createdAt: new Date('2025-01-02T00:00:00Z'),
};

describe('buildFestivalPosterData', () => {
  it('defaults status to pending and precision to year, nulling dates', () => {
    const d = buildFestivalPosterData({ ...base, startsAt: new Date(), endsAt: new Date() });
    expect(d.status).toBe('pending');
    expect(d.datePrecision).toBe('year');
    expect(d.startsAt).toBeNull();
    expect(d.endsAt).toBeNull();
    expect(d.proposedBy).toBeNull();
    expect(d.title).toBeNull();
    expect(d.imageURL).toBeNull();
    expect(() => FestivalPosterDataSchema.parse(d)).not.toThrow();
  });

  it('keeps startsAt/endsAt for day precision', () => {
    const s = new Date('2025-08-14T00:00:00Z');
    const e = new Date('2025-08-18T00:00:00Z');
    const d = buildFestivalPosterData({ ...base, datePrecision: 'day', startsAt: s, endsAt: e });
    expect(d.datePrecision).toBe('day');
    expect(d.startsAt).toEqual(s);
    expect(d.endsAt).toEqual(e);
  });

  it('throws when a precise precision has no startsAt', () => {
    expect(() => buildFestivalPosterData({ ...base, datePrecision: 'month' })).toThrow();
  });

  it('rejects a non-integer year at the schema boundary', () => {
    const d = buildFestivalPosterData(base);
    expect(() => FestivalPosterDataSchema.parse({ ...d, year: 2025.5 })).toThrow();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/models/festivalPoster/FestivalPosterDataModel.test.ts`
Expected: FAIL — cannot resolve `FestivalPosterDataModel`.

- [ ] **Step 3: Write the model**

```ts
// packages/shared/src/models/festivalPoster/FestivalPosterDataModel.ts
import { z } from 'zod';
import { reviewDecisionFields, type ReviewStatus } from '../core/ReviewableDataModel';

export const DATE_PRECISIONS = ['year', 'month', 'day'] as const;
export const DatePrecisionSchema = z.enum([...DATE_PRECISIONS]);
export type DatePrecision = z.infer<typeof DatePrecisionSchema>;

/** A village fiesta poster. Stored at /festivalPosters/{posterId} (top-level). */
export const FestivalPosterDataSchema = z.object({
  municipalityId: z.string(),
  proposedBy: z.string().nullable(),
  year: z.number().int(),
  title: z.string().nullable(),
  imageURL: z.string().nullable(),
  datePrecision: DatePrecisionSchema,
  startsAt: z.date().nullable(),
  endsAt: z.date().nullable(),
  createdAt: z.date(),
  ...reviewDecisionFields,
});
export type FestivalPosterData = z.infer<typeof FestivalPosterDataSchema>;

export interface FestivalPosterDataInput {
  municipalityId: string;
  proposedBy?: string | null;
  year: number;
  title?: string | null;
  imageURL?: string | null;
  datePrecision?: DatePrecision;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdAt: Date;
  status?: ReviewStatus;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
}

export function buildFestivalPosterData(input: FestivalPosterDataInput): FestivalPosterData {
  const datePrecision = input.datePrecision ?? 'year';
  // 'year' precision carries no dates; precise precisions must have a start.
  const startsAt = datePrecision === 'year' ? null : (input.startsAt ?? null);
  const endsAt = datePrecision === 'year' ? null : (input.endsAt ?? null);
  if (datePrecision !== 'year' && !startsAt) {
    throw new Error(`buildFestivalPosterData: datePrecision '${datePrecision}' requires startsAt`);
  }
  return {
    municipalityId: input.municipalityId,
    proposedBy: input.proposedBy ?? null,
    year: input.year,
    title: input.title ?? null,
    imageURL: input.imageURL ?? null,
    datePrecision,
    startsAt,
    endsAt,
    createdAt: input.createdAt,
    status: input.status ?? 'pending',
    reviewedBy: input.reviewedBy ?? null,
    reviewedAt: input.reviewedAt ?? null,
  };
}
```

```ts
// packages/shared/src/models/festivalPoster/index.ts
export * from './FestivalPosterDataModel';
```

Add to `packages/shared/src/models/index.ts` (alphabetical among the existing `export * from './<subfolder>'` lines):

```ts
export * from './festivalPoster';
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/models/festivalPoster/FestivalPosterDataModel.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/festivalPoster packages/shared/src/models/index.ts packages/shared/test/models/festivalPoster
git commit -m "feat(shared): festival poster model + builder"
```

---

### Task 2: Date-range formatter

**Files:**
- Modify: `packages/shared/src/utils/format.ts` (add `monthYear` style)
- Create: `packages/shared/src/utils/festivalPosterDates.ts`
- Modify: `packages/shared/src/utils/index.ts` (barrel — mirror how `format` is exported)
- Test: `packages/shared/test/utils/festivalPosterDates.test.ts`

**Interfaces:**
- Produces: `formatFestivalPosterDates(input): string | null` — `null` for `year` precision (card omits the line).

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/test/utils/festivalPosterDates.test.ts
import { describe, it, expect } from 'vitest';
import { formatFestivalPosterDates } from '../../src/utils/festivalPosterDates';

describe('formatFestivalPosterDates', () => {
  it('returns null for year precision', () => {
    expect(formatFestivalPosterDates({ year: 2025, datePrecision: 'year', startsAt: null, endsAt: null })).toBeNull();
  });
  it('formats a month as "Mes Año"', () => {
    expect(
      formatFestivalPosterDates({ year: 2025, datePrecision: 'month', startsAt: new Date(2025, 7, 1), endsAt: null }),
    ).toBe('Agosto 2025');
  });
  it('formats a day range', () => {
    expect(
      formatFestivalPosterDates({
        year: 2025, datePrecision: 'day',
        startsAt: new Date(2025, 7, 14), endsAt: new Date(2025, 7, 18),
      }),
    ).toBe('14 de Agosto – 18 de Agosto 2025');
  });
  it('formats a single day (no distinct end)', () => {
    expect(
      formatFestivalPosterDates({ year: 2025, datePrecision: 'day', startsAt: new Date(2025, 7, 14), endsAt: null }),
    ).toBe('14 de Agosto 2025');
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/utils/festivalPosterDates.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Add the `monthYear` style + the formatter**

In `packages/shared/src/utils/format.ts`, extend the `DateStyle` union with `'monthYear'` and add this case inside `formatDate` (mirror the capitalisation of the `dayMonth` case):

```ts
    case 'monthYear': {
      const parts = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' }).formatToParts(date);
      return parts
        .map((p) => (p.type === 'month' ? p.value.charAt(0).toUpperCase() + p.value.slice(1) : p.value))
        .join('');
    }
```

```ts
// packages/shared/src/utils/festivalPosterDates.ts
import { formatDate } from './format';
import type { DatePrecision } from '../models/festivalPoster/FestivalPosterDataModel';

/**
 * Secondary date line for a festival-poster card. Returns `null` for `year`
 * precision so the card shows only the big year with no redundant line.
 */
export function formatFestivalPosterDates(input: {
  year: number;
  datePrecision: DatePrecision;
  startsAt: Date | null;
  endsAt: Date | null;
}): string | null {
  if (input.datePrecision === 'year' || !input.startsAt) return null;
  if (input.datePrecision === 'month') return formatDate(input.startsAt, 'monthYear');
  const start = formatDate(input.startsAt, 'dayMonth');
  if (input.endsAt && input.endsAt.getTime() !== input.startsAt.getTime()) {
    return `${start} – ${formatDate(input.endsAt, 'dayMonth')} ${String(input.year)}`;
  }
  return `${start} ${String(input.year)}`;
}
```

Add `export * from './festivalPosterDates';` to `packages/shared/src/utils/index.ts` (mirror the existing `./format` export line; if there's no barrel there, skip this and rely on the deep import path used in Task 8).

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/utils/festivalPosterDates.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/utils/format.ts packages/shared/src/utils/festivalPosterDates.ts packages/shared/src/utils/index.ts packages/shared/test/utils/festivalPosterDates.test.ts
git commit -m "feat(shared): festival poster date-range formatter"
```

---

### Task 3: Converters + Firestore refs

**Files:**
- Create: `packages/shared/src/firebase/converters/festivalPosterConverter.client.ts`
- Create: `packages/shared/src/firebase/converters/festivalPosterConverter.admin.ts`
- Modify: `packages/shared/src/firebase/refs/client.ts`
- Modify: `packages/shared/src/firebase/refs/admin.ts`

**Interfaces:**
- Produces: `festivalPosterConverterClient`, `festivalPosterConverterAdmin`, `festivalPostersCollection(db)`, `festivalPosterDoc(db, id)` (client + admin variants).

- [ ] **Step 1: Create the converters** — copy `newsPostConverter.client.ts` / `.admin.ts` verbatim, swapping the schema import to `FestivalPosterDataSchema` and the export name:

```ts
// packages/shared/src/firebase/converters/festivalPosterConverter.client.ts
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkCtors'; // match the exact import newsPostConverter.client.ts uses
import { FestivalPosterDataSchema } from '../../models/festivalPoster/FestivalPosterDataModel';

export const festivalPosterConverterClient = makeConverter(FestivalPosterDataSchema, clientSdkCtors);
```

The `.admin.ts` file mirrors it with `adminSdkCtors`. **Match the neighbouring news/place converter files' exact import paths** — do not invent module names.

- [ ] **Step 2: Add the refs** — in `packages/shared/src/firebase/refs/client.ts`, next to `newsCollection`/`newsDoc`, import the client converter and add:

```ts
export const festivalPostersCollection = (db: Firestore) =>
  collection(db, 'festivalPosters').withConverter(festivalPosterConverterClient);
export const festivalPosterDoc = (db: Firestore, posterId: string) =>
  doc(db, 'festivalPosters', posterId).withConverter(festivalPosterConverterClient);
```

Mirror the same pair in `refs/admin.ts` using `festivalPosterConverterAdmin`.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @cultuvilla/shared exec tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/firebase/converters/festivalPosterConverter.* packages/shared/src/firebase/refs/client.ts packages/shared/src/firebase/refs/admin.ts
git commit -m "feat(shared): festival poster converters + refs"
```

---

### Task 4: Service + image upload + services map

**Files:**
- Create: `packages/shared/src/services/festivalPosterService.ts`
- Modify: `packages/shared/src/services/index.ts` (barrel)
- Modify: `packages/shared/src/services/imageService.ts` (add `uploadFestivalPosterImage`)
- Modify: `packages/shared/src/services/_services-map.md` (add a row)

**Interfaces:**
- Consumes: `festivalPostersCollection`, `festivalPosterDoc` (Task 3); `buildFestivalPosterData`, `FestivalPosterData`, `FestivalPosterDataInput` (Task 1); `getDb`, `UploadableImage`.
- Produces: `newFestivalPosterId()`, `proposeFestivalPoster(input, id?)`, `createFestivalPoster(input, id?)`, `getFestivalPosters(municipalityId, status?)`, `approveFestivalPoster(posterId, reviewedBy)`, `rejectFestivalPoster(posterId, reviewedBy)`, `updateFestivalPoster(posterId, patch)`, `deleteFestivalPoster(posterId)`, `FestivalPosterWithId`, `uploadFestivalPosterImage(municipalityId, posterId, image)`.

- [ ] **Step 1: Write the service** (structure mirrors `newsService` + `municipalityService`'s place trio):

```ts
// packages/shared/src/services/festivalPosterService.ts
import {
  collection, doc, deleteDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, where,
  type QueryConstraint,
} from 'firebase/firestore';
import { getDb } from '../firebase/client'; // match the exact import newsService uses
import { festivalPostersCollection, festivalPosterDoc } from '../firebase/refs/client';
import {
  buildFestivalPosterData,
  type FestivalPosterData,
  type FestivalPosterDataInput,
} from '../models/festivalPoster/FestivalPosterDataModel';
import type { ReviewStatus } from '../models/core/ReviewableDataModel';

export type FestivalPosterWithId = FestivalPosterData & { id: string };

/** Mint an id up front so the poster image can be uploaded before the doc write. */
export function newFestivalPosterId(): string {
  return doc(festivalPostersCollection(getDb())).id;
}

async function writePoster(id: string, input: FestivalPosterDataInput): Promise<string> {
  await setDoc(festivalPosterDoc(getDb(), id), buildFestivalPosterData(input));
  return id;
}

/** Villager proposal → status 'pending'. */
export function proposeFestivalPoster(
  input: Omit<FestivalPosterDataInput, 'status'> & { proposedBy: string },
  id: string = newFestivalPosterId(),
): Promise<string> {
  return writePoster(id, { ...input, status: 'pending' });
}

/** Admin direct add → status 'approved'. */
export function createFestivalPoster(
  input: Omit<FestivalPosterDataInput, 'status'>,
  id: string = newFestivalPosterId(),
): Promise<string> {
  return writePoster(id, { ...input, status: 'approved' });
}

export async function getFestivalPosters(
  municipalityId: string,
  status?: ReviewStatus,
): Promise<FestivalPosterWithId[]> {
  const constraints: QueryConstraint[] = [where('municipalityId', '==', municipalityId)];
  if (status) constraints.push(where('status', '==', status));
  constraints.push(orderBy('year', 'desc'));
  const snap = await getDocs(query(festivalPostersCollection(getDb()), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Partial writes use a raw (converter-less) ref: the SDK auto-converts Date → Timestamp,
// and updateDoc must not run the strict full-object converter. Approval is authorised
// entirely by firestore.rules (admin's allow-update is unconstrained on status).
export function approveFestivalPoster(posterId: string, reviewedBy: string): Promise<void> {
  return updateDoc(doc(getDb(), 'festivalPosters', posterId), {
    status: 'approved', reviewedBy, reviewedAt: serverTimestamp(),
  });
}

export function rejectFestivalPoster(posterId: string, reviewedBy: string): Promise<void> {
  return updateDoc(doc(getDb(), 'festivalPosters', posterId), {
    status: 'rejected', reviewedBy, reviewedAt: serverTimestamp(),
  });
}

export function updateFestivalPoster(
  posterId: string,
  patch: Partial<Pick<FestivalPosterData, 'year' | 'title' | 'imageURL' | 'datePrecision' | 'startsAt' | 'endsAt'>>,
): Promise<void> {
  return updateDoc(doc(getDb(), 'festivalPosters', posterId), patch);
}

export function deleteFestivalPoster(posterId: string): Promise<void> {
  return deleteDoc(doc(getDb(), 'festivalPosters', posterId));
}
```

> **Note:** verify the exact `getDb`/`collection`/`doc` import paths against `newsService.ts` — copy them, don't guess.

- [ ] **Step 2: Add the image uploader** — in `imageService.ts`, next to `uploadPlaceImage`, add (mirroring it, using the private `uploadToPath` that returns a download URL):

```ts
export function uploadFestivalPosterImage(
  municipalityId: string,
  posterId: string,
  image: UploadableImage,
): Promise<string> {
  return uploadToPath(`festivalPosters/${municipalityId}/${posterId}/poster`, image);
}
```

- [ ] **Step 3: Barrel + services map** — add `export * from './festivalPosterService';` to `services/index.ts`. Add one row to `_services-map.md`:

```
| [festivalPosterService](festivalPosterService.ts) | `festivalPosters/` (top-level, `municipalityId` field) | Village fiesta-poster archive; propose→approve (rules-only), year-desc reads. | `newFestivalPosterId`, `proposeFestivalPoster`, `createFestivalPoster`, `getFestivalPosters`, `approveFestivalPoster`, `rejectFestivalPoster`, `updateFestivalPoster`, `deleteFestivalPoster` |
```

Add `uploadFestivalPosterImage` to the `imageService` row's function list.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @cultuvilla/shared exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/services/festivalPosterService.ts packages/shared/src/services/index.ts packages/shared/src/services/imageService.ts packages/shared/src/services/_services-map.md
git commit -m "feat(shared): festival poster service + image upload"
```

---

### Task 5: Firestore rules, storage rules, index + rules e2e test

**Files:**
- Modify: `firestore.rules` (add `match /festivalPosters/{posterId}` + `isValidFestivalPosterProposalCreate` helper)
- Modify: `storage.rules` (allow the poster image path)
- Modify: `firestore.indexes.json` (composite index)
- Test: `packages/shared/test/e2e/festivalPosterRules.test.ts`

**Interfaces:**
- Consumes: existing rules helpers `isAppAdmin()`, `isVillageAdmin(mid)`, `isVillageMember(mid)`, `isOwner(uid)`, `isAuthenticated()`.

- [ ] **Step 1: Write the failing rules test** (mirror `placeProposalRules.test.ts` structure — `useRulesTestEnv`, `asUser`/`asAnon`/`seed` helpers):

```ts
// packages/shared/test/e2e/festivalPosterRules.test.ts
import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, asAnon, seed } from '../helpers/roles';

const M = 'muni1';
const getEnv = useRulesTestEnv();

function posterDoc(status: string, proposedBy: string | null) {
  return {
    municipalityId: M, proposedBy, year: 2025, title: null, imageURL: null,
    datePrecision: 'year', startsAt: null, endsAt: null, createdAt: new Date(),
    status, reviewedBy: null, reviewedAt: null,
  };
}
async function seedMember(uid: string, role: 'admin' | 'user' = 'user') {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/members/${uid}`), { role });
  });
}

describe('festivalPosters rules', () => {
  it('allows anyone to read', async () => {
    await assertSucceeds(getDoc(doc(asAnon(getEnv()), 'festivalPosters/p1')));
  });
  it('lets a member create a pending poster for themselves', async () => {
    await seedMember('u1');
    await assertSucceeds(setDoc(doc(asUser(getEnv(), 'u1'), 'festivalPosters/p1'), posterDoc('pending', 'u1')));
  });
  it('forbids a member from creating an already-approved poster', async () => {
    await seedMember('u1');
    await assertFails(setDoc(doc(asUser(getEnv(), 'u1'), 'festivalPosters/p2'), posterDoc('approved', 'u1')));
  });
  it('forbids proposing on behalf of another uid', async () => {
    await seedMember('u1');
    await assertFails(setDoc(doc(asUser(getEnv(), 'u1'), 'festivalPosters/p3'), posterDoc('pending', 'someone-else')));
  });
  it('forbids a non-member from proposing', async () => {
    await assertFails(setDoc(doc(asUser(getEnv(), 'stranger'), 'festivalPosters/p4'), posterDoc('pending', 'stranger')));
  });
  it('lets a village admin approve a pending poster', async () => {
    await seedMember('admin1', 'admin');
    await seed(getEnv(), async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'festivalPosters/p5'), posterDoc('pending', 'u1'));
    });
    await assertSucceeds(updateDoc(doc(asUser(getEnv(), 'admin1'), 'festivalPosters/p5'), { status: 'approved', reviewedBy: 'admin1', reviewedAt: new Date() }));
  });
  it('forbids the proposer from self-approving', async () => {
    await seedMember('u1');
    await seed(getEnv(), async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'festivalPosters/p6'), posterDoc('pending', 'u1'));
    });
    await assertFails(updateDoc(doc(asUser(getEnv(), 'u1'), 'festivalPosters/p6'), { status: 'approved', reviewedBy: 'u1', reviewedAt: new Date() }));
  });
  it('lets the proposer withdraw their own pending poster', async () => {
    await seedMember('u1');
    await seed(getEnv(), async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'festivalPosters/p7'), posterDoc('pending', 'u1'));
    });
    await assertSucceeds(deleteDoc(doc(asUser(getEnv(), 'u1'), 'festivalPosters/p7')));
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/e2e/festivalPosterRules.test.ts` (under the emulator harness the repo uses — ask the user to have emulators running if the harness needs them).
Expected: FAIL — no `festivalPosters` rule, all writes denied / read behaviour wrong.

- [ ] **Step 3: Add the rules** — in `firestore.rules`, add a validation helper (mirror `isValidPlaceProposalCreate`) and the match block:

```
function isValidFestivalPosterProposalCreate(d) {
  return d.keys().hasOnly(['municipalityId','proposedBy','year','title','imageURL','datePrecision','startsAt','endsAt','createdAt','status','reviewedBy','reviewedAt'])
    && d.keys().hasAll(['municipalityId','proposedBy','year','datePrecision','createdAt','status'])
    && d.municipalityId is string
    && d.year is int
    && d.datePrecision in ['year','month','day']
    && d.status in ['pending','approved','rejected'];
}

match /festivalPosters/{posterId} {
  allow read: if true;
  allow create: if isAppAdmin()
    || isVillageAdmin(request.resource.data.municipalityId)
    || ( isVillageMember(request.resource.data.municipalityId)
         && isValidFestivalPosterProposalCreate(request.resource.data)
         && request.resource.data.status == 'pending'
         && request.resource.data.proposedBy == request.auth.uid );
  allow update: if isVillageAdmin(resource.data.municipalityId) || isAppAdmin()
    || ( isOwner(resource.data.proposedBy)
         && resource.data.status == 'pending'
         && request.resource.data.status == 'pending' );
  allow delete: if isVillageAdmin(resource.data.municipalityId) || isAppAdmin()
    || ( isOwner(resource.data.proposedBy) && resource.data.status == 'pending' );
}
```

- [ ] **Step 4: Add the storage rule** — in `storage.rules`, mirror the place/org image path block for `festivalPosters/{municipalityId}/{posterId}/{fileName}`: read public, write allowed for a village member of `municipalityId` (copy the exact predicate the place image path uses).

- [ ] **Step 5: Add the composite index** — in `firestore.indexes.json`, add:

```json
{
  "collectionGroup": "festivalPosters",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "municipalityId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "year", "order": "DESCENDING" }
  ]
}
```

- [ ] **Step 6: Run the test, verify it passes**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/e2e/festivalPosterRules.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 7: Commit**

```bash
git add firestore.rules storage.rules firestore.indexes.json packages/shared/test/e2e/festivalPosterRules.test.ts
git commit -m "feat(rules): festival poster propose/approve rules + index"
```

---

### Task 6: i18n strings

**Files:**
- Modify: `packages/i18n/messages/es.json`

- [ ] **Step 1: Add the `village.festivalPosters` namespace** (nested JSON; match sibling `village.*` sections):

```json
"festivalPosters": {
  "title": "Carteles de fiestas",
  "empty": "Todavía no hay carteles de fiestas.",
  "add": "Añadir",
  "propose": "Proponer",
  "form": {
    "year": "Año",
    "title": "Nombre de las fiestas",
    "titlePlaceholder": "p. ej. San Roque",
    "precision": "Fechas",
    "precisionYear": "Solo año",
    "precisionMonth": "Mes",
    "precisionDay": "Días",
    "month": "Mes",
    "startDay": "Día de inicio",
    "endDay": "Día de fin",
    "image": "Cartel",
    "submit": "Guardar"
  },
  "viewer": { "close": "Cerrar" }
}
```

- [ ] **Step 2: Typecheck i18n**

Run: `pnpm --filter @cultuvilla/i18n exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "feat(i18n): carteles de fiestas strings"
```

---

### Task 7: Portrait poster card, add-card & full-screen viewer

**Files:**
- Modify: `apps/mobile/components/feature/VillageSections.tsx` (add `PosterCard`, `PosterAddCard`)
- Create: `apps/mobile/components/feature/FestivalPosterViewer.tsx`

**Interfaces:**
- Produces: `PosterCard`, `PosterAddCard` (exported from `VillageSections.tsx`); `FestivalPosterViewer` (default overlay component).

- [ ] **Step 1: Add the portrait cards** to `VillageSections.tsx` (reuse the module's `ACCENT`, `PLACEHOLDER_BG`, and primitives):

```tsx
const POSTER_W = 140;
const POSTER_H = 198; // portrait, ~√2 (A-series) ratio

export function PosterCard({
  year, title, dateLabel, imageUri, onPress,
}: {
  year: number;
  title?: string | null;
  dateLabel?: string | null;
  imageUri?: string | null;
  onPress?: () => void;
}) {
  const body = (
    <View className="rounded-2xl overflow-hidden" style={{ width: POSTER_W, height: POSTER_H, backgroundColor: PLACEHOLDER_BG }}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <View className="w-full h-full items-center justify-center">
          <Ionicons name="image" size={44} color={ACCENT} />
        </View>
      )}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <Text variant="h2" className="font-bold" style={{ color: '#ffffff' }}>{String(year)}</Text>
        {title ? (
          <Text variant="bodySm" numberOfLines={1} style={{ color: 'rgba(255,255,255,0.9)' }}>{title}</Text>
        ) : null}
        {dateLabel ? (
          <Text variant="bodySm" numberOfLines={1} style={{ color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{dateLabel}</Text>
        ) : null}
      </View>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityLabel={`${title ? `${title} ` : ''}${String(year)}`}>
      {body}
    </Pressable>
  );
}

export function PosterAddCard({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className="rounded-2xl overflow-hidden border border-dashed border-subtle items-center justify-center gap-2"
      style={{ width: POSTER_W, height: POSTER_H }}
    >
      <Ionicons name="add" size={44} color={ACCENT} />
      <Text variant="bodySm" className="font-medium text-center px-3" numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}
```

> If `Text` has no `h2` variant, use `h1`; check the primitive's variant union.

- [ ] **Step 2: Build the web-safe viewer** (absolute overlay, **not** RN `Modal`; pad the close button by `insets.top` per the safe-area convention):

```tsx
// apps/mobile/components/feature/FestivalPosterViewer.tsx
import { Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text } from '../primitives';
import { useT } from '../../lib/i18n';

export function FestivalPosterViewer({
  imageUri, caption, onClose,
}: {
  imageUri: string;
  caption?: string | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 50 }}>
      <Pressable
        onPress={onClose}
        accessibilityLabel={t('village.festivalPosters.viewer.close')}
        style={{ position: 'absolute', top: insets.top + 8, right: 16, zIndex: 51, padding: 8 }}
      >
        <Ionicons name="close" size={28} color="#ffffff" />
      </Pressable>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Image source={{ uri: imageUri }} style={{ width: '100%', height: '85%' }} resizeMode="contain" />
        {caption ? (
          <Text variant="body" style={{ color: '#ffffff', marginTop: 12 }} numberOfLines={2}>{caption}</Text>
        ) : null}
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/feature/VillageSections.tsx apps/mobile/components/feature/FestivalPosterViewer.tsx
git commit -m "feat(mobile): portrait poster card + full-screen viewer"
```

---

### Task 8: Fetch posters in village home + render the section

**Files:**
- Modify: `apps/mobile/lib/useVillageHome.ts` (add `festivalPosters` to state + fetch)
- Modify: `apps/mobile/app/(tabs)/village.tsx` (render the section + viewer state)
- Test: `apps/mobile/app/(tabs)/__tests__/village.test.tsx` (assert the section renders)

**Interfaces:**
- Consumes: `getFestivalPosters`, `FestivalPosterWithId`, `formatFestivalPosterDates` (shared); `PosterCard`, `PosterAddCard`, `Section` (Task 7); `FestivalPosterViewer` (Task 7).

- [ ] **Step 1: Extend `useVillageHome`** — add `festivalPosters: FestivalPosterWithId[]` to `VillageHomeState` and to `EMPTY` (`[]`); add to the `Promise.all` (approved-only), wrapped like its siblings:

```ts
festivalPosters: await withFirestoreErrorLog('villageHome:getFestivalPosters', () =>
  getFestivalPosters(municipalityId, 'approved'),
),
```

and set it in the resulting `setState({ ..., festivalPosters })`. Import `getFestivalPosters` / `FestivalPosterWithId` from `@cultuvilla/shared`.

- [ ] **Step 2: Render the section** in `village.tsx`, after an existing section (e.g. news). `canAdd` = any village member (villagers propose; admins add):

```tsx
<Section
  title={t('village.festivalPosters.title')}
  onManage={canManage ? () => {/* route to VillageContentManager posters tab */} : undefined}
  isEmpty={home.festivalPosters.length === 0 && !canAdd}
  emptyLabel={t('village.festivalPosters.empty')}
>
  {home.festivalPosters.map((p) => (
    <PosterCard
      key={p.id}
      year={p.year}
      title={p.title}
      dateLabel={formatFestivalPosterDates(p)}
      imageUri={p.imageURL}
      onPress={() => setViewerPoster(p)}
    />
  ))}
  {canAdd ? (
    <PosterAddCard
      label={canManage ? t('village.festivalPosters.add') : t('village.festivalPosters.propose')}
      onPress={() => {/* open FestivalPostersManager in create mode */}}
    />
  ) : null}
</Section>
```

Add `const [viewerPoster, setViewerPoster] = useState<FestivalPosterWithId | null>(null);` and, at the end of the screen tree, render the overlay:

```tsx
{viewerPoster?.imageURL ? (
  <FestivalPosterViewer
    imageUri={viewerPoster.imageURL}
    caption={`${viewerPoster.title ? `${viewerPoster.title} · ` : ''}${String(viewerPoster.year)}`}
    onClose={() => setViewerPoster(null)}
  />
) : null}
```

> Wire the `onManage` / `PosterAddCard` `onPress` to whatever navigation the sibling sections use to reach `VillageContentManager` (Task 9 adds the posters tab there). Match the existing pattern in `village.tsx`; don't invent a route.

- [ ] **Step 3: Update the mobile test** — extend `village.test.tsx` to stub `getFestivalPosters` returning one approved poster and assert the title text (`Carteles de fiestas`) and the poster year render. Mirror how the existing test stubs sibling services.

- [ ] **Step 4: Run typecheck + test**

Run: `pnpm app:typecheck && pnpm app:test -- village`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/useVillageHome.ts "apps/mobile/app/(tabs)/village.tsx" "apps/mobile/app/(tabs)/__tests__/village.test.tsx"
git commit -m "feat(mobile): carteles de fiestas scroll on village screen"
```

---

### Task 9: FestivalPostersManager (propose + moderate)

**Files:**
- Create: `apps/mobile/components/feature/proposable/FestivalPostersManager.tsx`
- Modify: `apps/mobile/components/feature/proposable/VillageContentManager.tsx` (register the section)
- Test: `apps/mobile/components/feature/proposable/__tests__/FestivalPostersManager.test.tsx`

**Interfaces:**
- Consumes: `newFestivalPosterId`, `proposeFestivalPoster`, `createFestivalPoster`, `approveFestivalPoster`, `rejectFestivalPoster`, `updateFestivalPoster`, `deleteFestivalPoster`, `uploadFestivalPosterImage`, `getFestivalPosters` (shared); `pickImageAsBlob` (`apps/mobile/lib/images`); `useEntityCapabilities`, `isProposalVisible` (mobile `lib/proposals`); `ProposableListItem`, `ManagerMode` (sibling `proposable/`).

- [ ] **Step 1: Build the manager** — structurally mirror `PlacesManager.tsx`. The **manage-mode list** (rows + approve/reject/edit/withdraw/delete wiring, `useEntityCapabilities`, `isProposalVisible` filtering) is a near-verbatim copy of `PlacesManager.tsx` — copy it and swap the service calls to `approveFestivalPoster(id, uid)` / `rejectFestivalPoster(id, uid)` / `deleteFestivalPoster(id)` and the row label to `` `${p.year}${p.title ? ` · ${p.title}` : ''}` ``. The **novel create-mode form** (no month/day picker exists to copy) is:

```tsx
// create-mode state
const [year, setYear] = useState(String(new Date().getFullYear()));
const [title, setTitle] = useState('');
const [precision, setPrecision] = useState<'year' | 'month' | 'day'>('year');
const [monthIndex, setMonthIndex] = useState(7); // 0-based; Aug default
const [startDay, setStartDay] = useState(1);
const [endDay, setEndDay] = useState(1);
const [image, setImage] = useState<Awaited<ReturnType<typeof pickImageAsBlob>>>(null);

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function computeDates(y: number): { startsAt: Date | null; endsAt: Date | null } {
  if (precision === 'year') return { startsAt: null, endsAt: null };
  if (precision === 'month') return { startsAt: new Date(y, monthIndex, 1), endsAt: null };
  return { startsAt: new Date(y, monthIndex, startDay), endsAt: new Date(y, monthIndex, endDay) };
}

async function onSubmit() {
  const y = parseInt(year, 10);
  if (!Number.isInteger(y) || !image) return; // year + image required
  const id = newFestivalPosterId();
  const imageURL = await uploadFestivalPosterImage(villageId, id, image);
  const { startsAt, endsAt } = computeDates(y);
  const payload = {
    municipalityId: villageId, year: y, title: title.trim() || null, imageURL,
    datePrecision: precision, startsAt, endsAt, createdAt: new Date(),
  };
  if (canManage) await createFestivalPoster(payload, id);
  else await proposeFestivalPoster({ ...payload, proposedBy: uid }, id);
  onCreated?.();
}
```

Render, using primitives only (no `Modal`/`Picker`/native date picker; chip rows for precision + months, `Input` for year, day steppers with `Pressable` +/−, an image-pick `Pressable` showing `image.previewUri` when set). Labels via `t('village.festivalPosters.form.*')`. Props match the sibling contract: `{ villageId: string; mode?: ManagerMode; onCreated?: () => void }`.

- [ ] **Step 2: Register in `VillageContentManager.tsx`** — add `'festivalPosters'` to the `Section` union, a `SECTIONS` entry `{ value: 'festivalPosters', label: t('village.festivalPosters.title') }`, and a render branch `{section === 'festivalPosters' ? <FestivalPostersManager villageId={villageId} mode="manage" /> : null}`.

- [ ] **Step 3: Write the manager test** — mirror `__tests__/PlacesManager.test.tsx`: render `mode="create"`, fill year + pick a stubbed image, submit, assert `proposeFestivalPoster` (non-admin) or `createFestivalPoster` (admin) was called with the expected `datePrecision`/`year`. Stub `uploadFestivalPosterImage` and `pickImageAsBlob`.

- [ ] **Step 4: Run typecheck + test**

Run: `pnpm app:typecheck && pnpm app:test -- FestivalPostersManager`
Expected: PASS.

- [ ] **Step 5: Full gate + commit**

Run: `pnpm check`
Expected: lint + typecheck + shared/functions tests + build all PASS.

```bash
git add apps/mobile/components/feature/proposable/FestivalPostersManager.tsx apps/mobile/components/feature/proposable/VillageContentManager.tsx apps/mobile/components/feature/proposable/__tests__/FestivalPostersManager.test.tsx
git commit -m "feat(mobile): propose/moderate carteles de fiestas"
```

---

### Deployment note

After merge to `develop`, the new composite index and rules deploy via CI to dev. If reads error with a missing-index message before CI runs, deploy the index/rules to dev with the `firestore-deploy` skill. No backfill needed (brand-new collection). No `functions/` change.
