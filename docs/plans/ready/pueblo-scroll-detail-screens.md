# Pueblo-tab scroll detail screens

**Goal:** Make every card in every village-tab ("pueblo") scroll open a read-only detail screen for all users, the way Eventos already opens `/event/[id]`.

## Context

The village tab (`apps/mobile/app/(tabs)/village.tsx`) renders several horizontal scrolls: Próximos eventos, Barrios, Lugares, Agrupaciones, Peñas. Today only Eventos is tappable for everyone. The other four navigate to the **admin management** screens and only do so when the viewer is an admin (`canManage`); non-admins tap dead cards.

The user wants parity with events/news: every item is a doorway into a detail screen, for everyone.

## Approach

### Navigation model

Card tap → **public detail screen** for everyone, including admins. Admins keep their management path via each section header's existing "Gestionar" / "+" affordances (`onManage` / `onAdd`), which stay exactly as they are. Tapping a *card* always means "show me this thing", never "manage this thing".

### Per-scroll changes

| Scroll | Today | After |
|---|---|---|
| Próximos eventos | → `/event/[id]` (everyone) | unchanged |
| Agrupaciones | → admin list (admins only) | → existing `/o/[orgId]` (everyone) |
| Peñas | → admin list (admins only) | → existing `/o/[orgId]` (everyone) |
| Barrios | → admin list (admins only) | **new** `/village/[villageId]/barrio/[barrioId]` (everyone) |
| Lugares | → admin list (admins only) | **new** `/village/[villageId]/place/[placeId]` (everyone) |

Agrupaciones/Peñas are a pure wiring fix — the org detail screen at `app/o/[orgId].tsx` already exists and already handles the public/join view. We just change the card `onPress` from the admin-gated management route to `/o/${o.id}` unconditionally.

### New routes (nested so both ids are in the path)

`villageId` **is** the `municipalityId`. Barrios and places are subcollection docs (`/municipalities/{id}/barrios/{barrioId}`, `/municipalities/{id}/places/{placeId}`), so the detail screen needs both ids. Nesting under the existing `village/[villageId]/` folder (which already holds `censo.tsx`, `organizations.tsx`) supplies both cleanly, with no query-param hacks:

- `apps/mobile/app/village/[villageId]/barrio/[barrioId].tsx`
- `apps/mobile/app/village/[villageId]/place/[placeId].tsx`

### Detail screen contents

**Barrio** — header (photo, name) + **residents**: people linked to this barrio. Each resident row taps through to `/person/[personId]`. Empty state when there are no residents.

**Lugar** — header (photo, name, localized kind label, description). When `kind === 'cemetery'`, also a **buried-here** list of people, each tapping through to `/person/[personId]`. Non-cemetery kinds (church, hermitage, plaza, town_hall) show the header only — no person link exists for them.

Both screens mirror the load/error/empty structure of the existing detail screens (`app/o/[orgId].tsx`, `app/event/[eventId].tsx`): `ActivityIndicator` while loading, `common.notFound` when the doc is missing, `AppHeader` with the entity name as `centerLabel`.

### Why the people queries are cheap

- **Barrio residents:** `MunicipalityLink` is exactly `{ municipalityId, barrioId }` (see `PersonDataModel.MunicipalityLinkSchema`), so an exact-object `array-contains` query works:
  `where('municipalityLinks', 'array-contains', { municipalityId, barrioId })`.
- **Cemetery burials:** `burialPlace` is a single nested object, so `where('burialPlace.placeId', '==', placeId)` works directly.

Neither needs denormalization. Results are ordered client-side by display name (a village has few persons per barrio/cemetery), or by an `orderBy` if it doesn't force a composite index — TBD-free: default to client-side sort to avoid index churn, matching the `getPlaces` "few rows, sort in memory" precedent.

### New shared-service functions

In `municipalityService.ts` (follow `touch-service` conventions — JSDoc, converter refs, re-export through `services/index.ts` and update `_services-map.md`):
- `getBarrio(municipalityId, barrioId): Promise<(BarrioData & { id }) | null>`
- `getPlace(municipalityId, placeId): Promise<(PlaceData & { id }) | null>`

In `personService.ts`:
- `getPersonsByBarrio(municipalityId, barrioId): Promise<(PersonData & { id })[]>`
- `getPersonsByBurialPlace(placeId): Promise<(PersonData & { id })[]>`

### Cross-cutting work

- **Firestore rules:** confirm `persons` is publicly readable (the two new queries run for any viewer). If reads are already open, no change; if gated, add the read allowance.
- **Firestore indexes:** add composite indexes only if the chosen query shape requires one. Default query shapes (single `array-contains`, single equality, no `orderBy`) need none.
- **i18n:** new strings for the barrio/place screens (residents heading, buried-here heading, empty states). Reuse existing place-kind labels if they already exist in the admin places screen; otherwise add them under the places namespace.
- **Tests:** vitest coverage for the four new service functions in `packages/shared`.

## Out of scope

- Deep-link share buttons for barrios/places. Events and orgs have share/invite buttons backed by `deepLinkService`; adding new deep-link types is separate work.
- Editing from the detail screen. Barrio/place detail stays read-only; all editing remains in the admin screens.
- Showing residents on non-cemetery places or any new person↔place relationship beyond the two that already exist in the data model.

---

# Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every village-tab scroll card open a read-only detail screen for all users.

**Architecture:** Two pure-wiring changes (agrupaciones + peñas already have `/o/[orgId]`), two new nested detail routes (`barrio`, `place`) backed by four new shared-service read functions. People are linked to barrios via an exact-object `array-contains` query and to cemeteries via a dotted-path equality query — no denormalization.

**Tech Stack:** React Native + Expo Router (mobile), `@cultuvilla/shared` services (Firebase Web SDK), vitest, next-intl-style message catalog (`packages/i18n/messages/es.json`), `useT()` on mobile.

## Global Constraints

- Mobile-facing strings MUST come from the i18n catalog (`packages/i18n/messages/es.json`) via `useT()` — no hardcoded Spanish in `apps/mobile/`.
- Service edits follow `touch-service` conventions: JSDoc on new exports, re-export is automatic via `services/index.ts` (`export * from`), and `_services-map.md` must be updated.
- `persons` is already `allow read: if isAuthenticated()` — the app requires auth, so the new list queries need **no** firestore.rules change.
- Default query shapes (single `array-contains`, single equality, no `orderBy`) require **no** composite index. Sort is done in memory (matches the `getPlaces` precedent).
- Relative import depth for the new routes (`app/village/[villageId]/<x>/[id].tsx`) to reach `apps/mobile/`: `../../../../`.

---

## File Structure

- **Modify** `packages/shared/src/services/municipalityService.ts` — add `getBarrio`, `getPlace`.
- **Modify** `packages/shared/src/services/personService.ts` — add `getPersonsByBarrio`, `getPersonsByBurialPlace`.
- **Modify** `packages/shared/src/services/_services-map.md` — list the four new exports.
- **Create** `packages/shared/test/services/municipalityNested.test.ts` — tests for `getBarrio`/`getPlace`.
- **Create** `packages/shared/test/services/personPlaceQueries.test.ts` — tests for the two person queries.
- **Modify** `packages/i18n/messages/es.json` — add `village.barrioDetail.*` and `village.placeDetail.*`.
- **Create** `apps/mobile/app/village/[villageId]/barrio/[barrioId].tsx` — barrio detail screen.
- **Create** `apps/mobile/app/village/[villageId]/place/[placeId].tsx` — place detail screen.
- **Modify** `apps/mobile/app/(tabs)/village.tsx` — repoint the agrupaciones, peñas, barrios, lugares card `onPress`.
- **Modify** `apps/mobile/app/(tabs)/__tests__/village.test.tsx` — assert the new navigation targets.

---

### Task 1: `getBarrio` / `getPlace` shared services

**Files:**
- Modify: `packages/shared/src/services/municipalityService.ts`
- Modify: `packages/shared/src/services/_services-map.md`
- Test: `packages/shared/test/services/municipalityNested.test.ts`

**Interfaces:**
- Produces: `getBarrio(municipalityId: string, barrioId: string): Promise<(BarrioData & { id: string }) | null>`; `getPlace(municipalityId: string, placeId: string): Promise<(PlaceData & { id: string }) | null>`

- [ ] **Step 1: Write the failing test** — `packages/shared/test/services/municipalityNested.test.ts`

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getDb: () => ({}) }));

let store: Record<string, any> = {};

vi.mock('firebase/firestore', () => {
  function doc(_db: unknown, ...path: string[]) {
    const _id = path.join('/');
    const ref: any = { _id, id: path[path.length - 1] };
    ref.withConverter = () => ref;
    return ref;
  }
  async function getDoc(ref: any) {
    const d = store[ref._id];
    return { id: ref.id, exists: () => d !== undefined, data: () => d };
  }
  return {
    doc,
    getDoc,
    // refs/client also imports these at module load; stub them as no-ops.
    collection: () => ({ withConverter: () => ({}) }),
    query: () => ({}),
    where: () => ({}),
    orderBy: () => ({}),
    getDocs: async () => ({ docs: [] }),
    setDoc: async () => undefined,
    updateDoc: async () => undefined,
    deleteDoc: async () => undefined,
  };
});

import { getBarrio, getPlace } from '../../src/services/municipalityService';

beforeEach(() => {
  store = {};
});

describe('getBarrio', () => {
  it('returns the barrio with its id when it exists', async () => {
    store['municipalities/m1/barrios/b1'] = { name: 'Centro', municipalityId: 'm1', imageURL: null };
    const b = await getBarrio('m1', 'b1');
    expect(b).toEqual({ id: 'b1', name: 'Centro', municipalityId: 'm1', imageURL: null });
  });

  it('returns null when the barrio is missing', async () => {
    expect(await getBarrio('m1', 'nope')).toBeNull();
  });
});

describe('getPlace', () => {
  it('returns the place with its id when it exists', async () => {
    store['municipalities/m1/places/p1'] = {
      name: 'San Roque', kind: 'cemetery', description: null, municipalityId: 'm1', imageURL: null,
    };
    const p = await getPlace('m1', 'p1');
    expect(p).toMatchObject({ id: 'p1', name: 'San Roque', kind: 'cemetery' });
  });

  it('returns null when the place is missing', async () => {
    expect(await getPlace('m1', 'nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm --filter @cultuvilla/shared test municipalityNested`
Expected: FAIL — `getBarrio`/`getPlace` are not exported.

- [ ] **Step 3: Add the implementations** to `municipalityService.ts` (after `deleteBarrio` / near the places section). `getDoc`, `municipalityBarrioDoc`, `municipalityPlaceDoc` are already imported in this file.

```ts
/** Fetch a single barrio document, or `null` if it does not exist. */
export async function getBarrio(
  municipalityId: string,
  barrioId: string,
): Promise<(BarrioData & { id: string }) | null> {
  const snap = await getDoc(municipalityBarrioDoc(getDb(), municipalityId, barrioId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Fetch a single place document, or `null` if it does not exist. */
export async function getPlace(
  municipalityId: string,
  placeId: string,
): Promise<(PlaceData & { id: string }) | null> {
  const snap = await getDoc(municipalityPlaceDoc(getDb(), municipalityId, placeId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
```

If `municipalityPlaceDoc` is not already imported in this file, add it to the existing `refs/client` import.

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm --filter @cultuvilla/shared test municipalityNested`
Expected: PASS (4 tests).

- [ ] **Step 5: Update `_services-map.md`** — append `getBarrio`, `getPlace` to the `municipalityService` row's exports list.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/services/municipalityService.ts packages/shared/src/services/_services-map.md packages/shared/test/services/municipalityNested.test.ts
git commit -m "feat(shared): add getBarrio/getPlace single-doc getters"
```

---

### Task 2: `getPersonsByBarrio` / `getPersonsByBurialPlace`

**Files:**
- Modify: `packages/shared/src/services/personService.ts`
- Modify: `packages/shared/src/services/_services-map.md`
- Test: `packages/shared/test/services/personPlaceQueries.test.ts`

**Interfaces:**
- Consumes: `buildDisplayName` from `../models/person`.
- Produces: `getPersonsByBarrio(municipalityId: string, barrioId: string): Promise<(PersonData & { id: string })[]>`; `getPersonsByBurialPlace(placeId: string): Promise<(PersonData & { id: string })[]>`. Both sorted by display name asc.

- [ ] **Step 1: Write the failing test** — `packages/shared/test/services/personPlaceQueries.test.ts`. This fake supports the two operators these functions use: `array-contains` with deep object equality, and `==` on a dotted path.

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getDb: () => ({}) }));

let store: Record<string, any> = {};

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function getPath(obj: any, path: string): unknown {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

vi.mock('firebase/firestore', () => {
  function collection(_db: unknown, colId: string) {
    const ref: any = { _col: colId };
    ref.withConverter = () => ref;
    return ref;
  }
  function where(field: string, op: string, value: unknown) {
    return { _type: 'where', field, op, value };
  }
  function query(colRef: any, ...constraints: any[]) {
    return { _col: colRef._col, _constraints: constraints };
  }
  async function getDocs(q: any) {
    const prefix = `${q._col}/`;
    let docs = Object.entries(store)
      .filter(([id]) => id.startsWith(prefix))
      .map(([id, data]) => ({ id: id.slice(prefix.length), data: () => data }));
    for (const c of q._constraints) {
      if (c._type !== 'where') continue;
      docs = docs.filter((d) => {
        const fieldVal = getPath(d.data(), c.field);
        if (c.op === '==') return fieldVal === c.value;
        if (c.op === 'array-contains') {
          return Array.isArray(fieldVal) && fieldVal.some((el) => deepEqual(el, c.value));
        }
        return true;
      });
    }
    return { docs };
  }
  return {
    collection, where, query, getDocs,
    doc: (_db: unknown, ...p: string[]) => ({ _id: p.join('/'), id: p[p.length - 1], withConverter() { return this; } }),
    getDoc: async () => ({ exists: () => false, data: () => undefined }),
    orderBy: () => ({}), limit: () => ({}),
    addDoc: async () => ({ id: 'x' }), updateDoc: async () => undefined, deleteDoc: async () => undefined,
  };
});

import { getPersonsByBarrio, getPersonsByBurialPlace } from '../../src/services/personService';

function person(extra: Record<string, any>) {
  return {
    givenName: 'A', middleNames: [], firstSurname: null, secondSurname: null, nickname: null,
    sex: null, birthday: null, deathDate: null, birthPlace: null, burialPlace: null,
    municipalityLinks: [], occupationIds: [], pendingOccupations: [], biography: null,
    photoURL: null, userId: null, createdBy: 'u1', ...extra,
  };
}

beforeEach(() => {
  store = {};
});

describe('getPersonsByBarrio', () => {
  it('returns only people whose municipalityLinks include the exact {municipalityId, barrioId}', async () => {
    store['persons/p1'] = person({ givenName: 'Ana', municipalityLinks: [{ municipalityId: 'm1', barrioId: 'b1' }] });
    store['persons/p2'] = person({ givenName: 'Beto', municipalityLinks: [{ municipalityId: 'm1', barrioId: 'b2' }] });
    store['persons/p3'] = person({ givenName: 'Carla', municipalityLinks: [{ municipalityId: 'm1', barrioId: 'b1' }] });
    const res = await getPersonsByBarrio('m1', 'b1');
    expect(res.map((p) => p.id)).toEqual(['p1', 'p3']); // sorted by display name: Ana, Carla
  });

  it('returns an empty array when nobody is linked', async () => {
    expect(await getPersonsByBarrio('m1', 'bX')).toEqual([]);
  });
});

describe('getPersonsByBurialPlace', () => {
  it('returns people whose burialPlace.placeId matches, sorted by display name', async () => {
    store['persons/p1'] = person({ givenName: 'Zoe', burialPlace: { municipalityId: 'm1', placeId: 'c1' } });
    store['persons/p2'] = person({ givenName: 'Aldo', burialPlace: { municipalityId: 'm1', placeId: 'c1' } });
    store['persons/p3'] = person({ givenName: 'Bea', burialPlace: { municipalityId: 'm1', placeId: 'c2' } });
    const res = await getPersonsByBurialPlace('c1');
    expect(res.map((p) => p.id)).toEqual(['p2', 'p1']); // Aldo before Zoe
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm --filter @cultuvilla/shared test personPlaceQueries`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Add the implementations** to `personService.ts`. Add `where` to the existing `firebase/firestore` import (already imports `query`, `getDocs`, `where`), and add `buildDisplayName` to the `../models/person` import.

```ts
/** People linked to a given barrio (residence link in `municipalityLinks`). */
export async function getPersonsByBarrio(
  municipalityId: string,
  barrioId: string,
): Promise<(PersonData & { id: string })[]> {
  const q = query(
    personsCollection(getDb()),
    where('municipalityLinks', 'array-contains', { municipalityId, barrioId }),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => buildDisplayName(a).localeCompare(buildDisplayName(b)));
}

/** People buried in a given place (cemetery), via `burialPlace.placeId`. */
export async function getPersonsByBurialPlace(
  placeId: string,
): Promise<(PersonData & { id: string })[]> {
  const q = query(personsCollection(getDb()), where('burialPlace.placeId', '==', placeId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => buildDisplayName(a).localeCompare(buildDisplayName(b)));
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm --filter @cultuvilla/shared test personPlaceQueries`
Expected: PASS (3 tests).

- [ ] **Step 5: Update `_services-map.md`** — append `getPersonsByBarrio`, `getPersonsByBurialPlace` to the `personService` row.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/services/personService.ts packages/shared/src/services/_services-map.md packages/shared/test/services/personPlaceQueries.test.ts
git commit -m "feat(shared): query persons by barrio and by burial place"
```

---

### Task 3: i18n strings for the detail screens

**Files:**
- Modify: `packages/i18n/messages/es.json`

**Interfaces:**
- Produces keys: `village.barrioDetail.residents`, `village.barrioDetail.residentsEmpty`, `village.placeDetail.buried`, `village.placeDetail.buriedEmpty`. (Kind labels reuse the existing `village.admin.places.kind.<kind>`.)

- [ ] **Step 1: Add the keys** inside the existing `village` object in `packages/i18n/messages/es.json` (e.g. just after the `village.hub` block):

```json
"barrioDetail": {
  "residents": "Vecinos",
  "residentsEmpty": "Aún no hay vecinos registrados en este barrio"
},
"placeDetail": {
  "buried": "Personas enterradas aquí",
  "buriedEmpty": "Aún no hay personas registradas en este lugar"
},
```

- [ ] **Step 2: Verify the catalog still type-checks and parses**

Run: `pnpm i18n:typecheck`
Expected: PASS (no type errors; valid JSON).

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "i18n: add barrio/place detail strings"
```

---

### Task 4: Barrio detail screen

**Files:**
- Create: `apps/mobile/app/village/[villageId]/barrio/[barrioId].tsx`

**Interfaces:**
- Consumes: `getBarrio` (Task 1), `getPersonsByBarrio` (Task 2), `buildDisplayName`, `PersonCard`, `ScreenHeader`, `village.barrioDetail.*` (Task 3).

- [ ] **Step 1: Create the screen.** Models on `app/o/[orgId].tsx`; uses `ScreenHeader` (title + back) like `app/village/[villageId]/censo.tsx`. Import depth is `../../../../`.

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../../../components/primitives/Screen';
import { VStack } from '../../../../components/primitives/VStack';
import { Text } from '../../../../components/primitives/Text';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { PersonCard } from '../../../../components/feature/VillageSections';
import { useT } from '../../../../lib/i18n';
import { getBarrio } from '@cultuvilla/shared/services/municipalityService';
import { getPersonsByBarrio } from '@cultuvilla/shared/services/personService';
import { buildDisplayName } from '@cultuvilla/shared/models/person';
import type { BarrioData } from '@cultuvilla/shared/models/municipality';
import type { PersonData } from '@cultuvilla/shared/models/person';

type Barrio = BarrioData & { id: string };
type Person = PersonData & { id: string };

export default function BarrioDetailScreen() {
  const { villageId, barrioId } = useLocalSearchParams<{ villageId: string; barrioId: string }>();
  const { t } = useT();
  const [barrio, setBarrio] = useState<Barrio | null>(null);
  const [residents, setResidents] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!villageId || !barrioId) return;
    void (async () => {
      const [b, people] = await Promise.all([
        getBarrio(villageId, barrioId),
        getPersonsByBarrio(villageId, barrioId),
      ]);
      setBarrio(b);
      setResidents(people);
      setLoading(false);
    })();
  }, [villageId, barrioId]);

  return (
    <Screen padded={false}>
      <ScreenHeader title={barrio?.name ?? ''} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : !barrio ? (
        <View className="p-4">
          <Text>{t('common.notFound')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerClassName="pb-10">
          {barrio.imageURL ? (
            <Image source={{ uri: barrio.imageURL }} className="w-full h-40" resizeMode="cover" />
          ) : null}
          <VStack gap={3} className="p-4">
            <Text variant="h2">{t('village.barrioDetail.residents')}</Text>
            {residents.length === 0 ? (
              <Text tone="muted" variant="bodySm">
                {t('village.barrioDetail.residentsEmpty')}
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
                {residents.map((p) => (
                  <PersonCard
                    key={p.id}
                    name={buildDisplayName(p)}
                    photoURL={p.photoURL}
                    onPress={() => router.push(`/person/${p.id}` as never)}
                  />
                ))}
              </ScrollView>
            )}
          </VStack>
        </ScrollView>
      )}
    </Screen>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter cultuvilla-mobile exec tsc --noEmit`
Expected: PASS (no errors in the new file). Confirm `common.notFound` exists in `es.json`; if not, use an existing not-found key.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/village/[villageId]/barrio/[barrioId].tsx"
git commit -m "feat(mobile): add barrio detail screen with residents"
```

---

### Task 5: Place detail screen

**Files:**
- Create: `apps/mobile/app/village/[villageId]/place/[placeId].tsx`

**Interfaces:**
- Consumes: `getPlace` (Task 1), `getPersonsByBurialPlace` (Task 2), `buildDisplayName`, `PersonCard`, `ScreenHeader`, `village.placeDetail.*` (Task 3), `village.admin.places.kind.<kind>`.

- [ ] **Step 1: Create the screen.** Buried-here list shows only when `kind === 'cemetery'`.

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../../../components/primitives/Screen';
import { VStack } from '../../../../components/primitives/VStack';
import { Text } from '../../../../components/primitives/Text';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { PersonCard } from '../../../../components/feature/VillageSections';
import { useT } from '../../../../lib/i18n';
import { getPlace } from '@cultuvilla/shared/services/municipalityService';
import { getPersonsByBurialPlace } from '@cultuvilla/shared/services/personService';
import { buildDisplayName } from '@cultuvilla/shared/models/person';
import type { PlaceData } from '@cultuvilla/shared/models/municipality';
import type { PersonData } from '@cultuvilla/shared/models/person';

type Place = PlaceData & { id: string };
type Person = PersonData & { id: string };

export default function PlaceDetailScreen() {
  const { villageId, placeId } = useLocalSearchParams<{ villageId: string; placeId: string }>();
  const { t } = useT();
  const [place, setPlace] = useState<Place | null>(null);
  const [buried, setBuried] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!villageId || !placeId) return;
    void (async () => {
      const p = await getPlace(villageId, placeId);
      setPlace(p);
      if (p?.kind === 'cemetery') {
        setBuried(await getPersonsByBurialPlace(placeId));
      }
      setLoading(false);
    })();
  }, [villageId, placeId]);

  return (
    <Screen padded={false}>
      <ScreenHeader title={place?.name ?? ''} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : !place ? (
        <View className="p-4">
          <Text>{t('common.notFound')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerClassName="pb-10">
          {place.imageURL ? (
            <Image source={{ uri: place.imageURL }} className="w-full h-40" resizeMode="cover" />
          ) : null}
          <VStack gap={3} className="p-4">
            <Text tone="muted" variant="bodySm">
              {t(`village.admin.places.kind.${place.kind}` as never)}
            </Text>
            {place.description ? <Text>{place.description}</Text> : null}
            {place.kind === 'cemetery' ? (
              <VStack gap={3}>
                <Text variant="h2">{t('village.placeDetail.buried')}</Text>
                {buried.length === 0 ? (
                  <Text tone="muted" variant="bodySm">
                    {t('village.placeDetail.buriedEmpty')}
                  </Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
                    {buried.map((p) => (
                      <PersonCard
                        key={p.id}
                        name={buildDisplayName(p)}
                        photoURL={p.photoURL}
                        onPress={() => router.push(`/person/${p.id}` as never)}
                      />
                    ))}
                  </ScrollView>
                )}
              </VStack>
            ) : null}
          </VStack>
        </ScrollView>
      )}
    </Screen>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter cultuvilla-mobile exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/village/[villageId]/place/[placeId].tsx"
git commit -m "feat(mobile): add place detail screen with burials"
```

---

### Task 6: Wire the village-tab cards + update test

**Files:**
- Modify: `apps/mobile/app/(tabs)/village.tsx`
- Modify: `apps/mobile/app/(tabs)/__tests__/village.test.tsx`

**Interfaces:**
- Consumes: routes `/o/[orgId]`, `/village/[villageId]/barrio/[barrioId]`, `/village/[villageId]/place/[placeId]`.

- [ ] **Step 1: Update the four card `onPress` handlers in `village.tsx`.** Every card navigates for **everyone** (drop the `canManage ? … : undefined` gate on the card press — `onManage`/`onAdd` stay admin-gated and unchanged).

Barrios card:
```tsx
onPress={() => router.push(`/village/${village.id}/barrio/${b.id}` as never)}
```
Lugares card:
```tsx
onPress={() => router.push(`/village/${village.id}/place/${p.id}` as never)}
```
Agrupaciones card and Peñas card:
```tsx
onPress={() => router.push(`/o/${o.id}` as never)}
```

- [ ] **Step 2: Update `village.test.tsx`.** Inspect the existing tests first; add/adjust assertions that tapping a barrio card pushes `/village/<id>/barrio/<bid>`, a lugar card pushes `/village/<id>/place/<pid>`, and an agrupación/peña card pushes `/o/<oid>` — for a non-admin viewer (the case that was previously a dead tap).

- [ ] **Step 3: Run the mobile test**

Run: `pnpm --filter cultuvilla-mobile test village`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(tabs)/village.tsx" "apps/mobile/app/(tabs)/__tests__/village.test.tsx"
git commit -m "feat(mobile): open detail screens from every pueblo-tab scroll"
```

---

### Task 7: Full verification

- [ ] **Step 1: Shared tests** — `pnpm shared:test` → all pass.
- [ ] **Step 2: Shared typecheck** — `pnpm shared:typecheck` → pass.
- [ ] **Step 3: Mobile tests** — `pnpm app:test` → pass.
- [ ] **Step 4: i18n typecheck** — `pnpm i18n:typecheck` → pass.
- [ ] **Step 5: Lint** — `pnpm lint` → pass.
- [ ] **Step 6: Manual check** (optional, via `drive-android-avd`) — open the village tab as a non-admin, tap a barrio, a lugar, an agrupación, and a peña; confirm each opens its detail screen and back returns to the tab.
