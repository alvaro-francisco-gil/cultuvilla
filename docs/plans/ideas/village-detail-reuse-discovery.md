# Village Detail Reuse + Discovery Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make discovery's tapped village open a back-navigable screen that reuses the pueblo-tab home (same horizontal scrolls), and turn discovery into a search + "Municipios activos" + infinite-scroll "Todos" list with awakened/dormant badges.

**Architecture:** Extract the pueblo tab's data loading into a `useVillageHome(municipalityId)` hook and its UI into a presentational `<VillageHomeBody>` component. The tab and the pushed `/village/[villageId]` screen both render `<VillageHomeBody>` under their own header (AppHeader vs ScreenHeader). A new `listMunicipalitiesPage` service powers cursor-paginated discovery.

**Tech Stack:** Expo / React Native + expo-router, NativeWind, `useT()` i18n, Firebase Firestore (web SDK) in `@cultuvilla/shared`, vitest (shared), jest (mobile).

## Global Constraints

- Spec: `docs/plans/ideas/village-detail-reuse-discovery-design.md`. Every task's requirements implicitly include the spec's "What this binds" section.
- `<VillageHomeBody>` contains **no village-data fetching** and **no header chrome** (no AppHeader/ScreenHeader). It may use context hooks (`useAuth`, `useIsAppAdmin`, `useShareDeepLink`, `useT`).
- Self-join CTA visibility is exactly `!data.isMember` — the single source of truth. Do not re-gate per host.
- `mobile-web-compat`: `Alert.alert` is a no-op on RN-Web. Any `Alert.alert` must branch `Platform.OS === 'web'` → `window.confirm`, OR carry a `// mobile-web-compat: native-only` annotation. Enforced by `scripts/check-mobile-web-compat.mjs`.
- commitlint: commit header ≤100 chars. Co-author trailer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- `NativeWind drops className on Animated.View` — irrelevant here (no Animated), but keep styles on `style` for any Animated component.
- Run shared tests with `pnpm --filter @cultuvilla/shared test`; mobile tests with `pnpm --filter mobile test` (or the repo's `pnpm check` for the full sweep). `@cultuvilla/shared` must be built (`pnpm shared:build`) before mobile typechecks resolve its dist.

---

### Task 1: `listMunicipalitiesPage` cursor service

**Files:**
- Modify: `packages/shared/src/services/municipalityService.ts`
- Test: `packages/shared/test/services/municipalityPage.test.ts` (create)

**Interfaces:**
- Consumes: existing `municipalitySearchKey`, `municipalitiesCollection`, `getDb`.
- Produces:
  ```ts
  import type { QueryDocumentSnapshot } from 'firebase/firestore';
  export interface MunicipalitiesPage {
    items: (MunicipalityData & { id: string })[];
    nextCursor: QueryDocumentSnapshot | null;
  }
  export function listMunicipalitiesPage(opts: {
    search?: string;
    cursor?: QueryDocumentSnapshot | null;
    limit?: number;
  }): Promise<MunicipalitiesPage>;
  ```

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/services/municipalityPage.test.ts`. Follow the in-memory mock style of `municipalityNested.test.ts` (eslint-disable header + `vi.mock`). The fake records the args passed to `startAfter`/`limit`/`where` so we can assert cursor + prefix behaviour, and returns a controllable list of docs.

```ts
/* eslint-disable @typescript-eslint/no-explicit-any,
                  @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-unsafe-member-access,
                  @typescript-eslint/no-unsafe-return,
                  @typescript-eslint/require-await */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getDb: () => ({}) }));

// Calls recorded by the firestore fake, and the docs the next getDocs returns.
let calls: { startAfter: unknown[]; limit: number | null; where: any[] };
let nextDocs: any[];

vi.mock('firebase/firestore', () => ({
  collection: () => ({ withConverter: () => ({}) }),
  query: (...parts: any[]) => ({ parts }),
  orderBy: (field: string, dir: string) => ({ _t: 'orderBy', field, dir }),
  where: (field: string, op: string, value: unknown) => {
    calls.where.push({ field, op, value });
    return { _t: 'where', field, op, value };
  },
  startAfter: (cursor: unknown) => {
    calls.startAfter.push(cursor);
    return { _t: 'startAfter', cursor };
  },
  limit: (n: number) => {
    calls.limit = n;
    return { _t: 'limit', n };
  },
  getDocs: async () => ({ docs: nextDocs }),
}));

import { listMunicipalitiesPage } from '../../src/services/municipalityService';

function fakeDoc(id: string, name: string) {
  return { id, data: () => ({ name, nameLower: name.toLowerCase() }) };
}

beforeEach(() => {
  calls = { startAfter: [], limit: null, where: [] };
  nextDocs = [];
});

describe('listMunicipalitiesPage', () => {
  it('returns items and a nextCursor when a full page comes back', async () => {
    nextDocs = [fakeDoc('a', 'Ávila'), fakeDoc('b', 'Burgos')];
    const page = await listMunicipalitiesPage({ limit: 2 });
    expect(page.items).toEqual([
      { id: 'a', name: 'Ávila', nameLower: 'ávila' },
      { id: 'b', name: 'Burgos', nameLower: 'burgos' },
    ]);
    expect(page.nextCursor).toBe(nextDocs[1]); // last snapshot of a full page
    expect(calls.limit).toBe(2);
    expect(calls.startAfter).toHaveLength(0); // no cursor on first page
  });

  it('returns nextCursor === null when the page is short (list exhausted)', async () => {
    nextDocs = [fakeDoc('a', 'Ávila')];
    const page = await listMunicipalitiesPage({ limit: 2 });
    expect(page.nextCursor).toBeNull();
  });

  it('passes the cursor to startAfter on follow-on pages', async () => {
    const cursor = fakeDoc('a', 'Ávila') as any;
    nextDocs = [fakeDoc('b', 'Burgos')];
    await listMunicipalitiesPage({ cursor, limit: 1 });
    expect(calls.startAfter).toEqual([cursor]);
  });

  it('applies prefix where-clauses when search is non-empty', async () => {
    nextDocs = [];
    await listMunicipalitiesPage({ search: 'avi', limit: 5 });
    const fields = calls.where.map((w) => `${w.field} ${w.op}`);
    expect(fields).toContain('nameLower >=');
    expect(fields).toContain('nameLower <');
  });

  it('applies no where-clauses when search is empty', async () => {
    nextDocs = [];
    await listMunicipalitiesPage({ limit: 5 });
    expect(calls.where).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared test municipalityPage`
Expected: FAIL — `listMunicipalitiesPage is not a function` (not yet exported).

- [ ] **Step 3: Implement `listMunicipalitiesPage`**

In `packages/shared/src/services/municipalityService.ts`: add `startAfter` and the `QueryDocumentSnapshot` type to the `firebase/firestore` import, then add the function right after `getActiveCommunities` (around line 102).

Add to the existing import block:
```ts
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  startAfter,
  limit as firestoreLimit,
  serverTimestamp,
  type UpdateData,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
```

Add the function:
```ts
export interface MunicipalitiesPage {
  items: (MunicipalityData & { id: string })[];
  nextCursor: QueryDocumentSnapshot | null;
}

/**
 * One cursor-paginated page of municipalities ordered by `nameLower`.
 *
 * - `search` (optional) applies the same accent-stripped prefix match as
 *   `searchMunicipalities` so the active-group filter and the full-list search
 *   agree.
 * - `cursor` is the opaque `nextCursor` from the previous page (omit/`null`
 *   for the first page). Pages with `startAfter`.
 * - `nextCursor` is the last snapshot of a full page, or `null` once fewer
 *   than `limit` rows come back (list exhausted).
 */
export async function listMunicipalitiesPage(opts: {
  search?: string;
  cursor?: QueryDocumentSnapshot | null;
  limit?: number;
}): Promise<MunicipalitiesPage> {
  const pageSize = opts.limit ?? 20;
  const key = municipalitySearchKey((opts.search ?? '').trim());
  const constraints = [orderBy('nameLower', 'asc')];
  if (key.length > 0) {
    constraints.push(where('nameLower', '>=', key));
    constraints.push(where('nameLower', '<', key + ''));
  }
  if (opts.cursor) constraints.push(startAfter(opts.cursor));
  constraints.push(firestoreLimit(pageSize));

  const snap = await getDocs(query(municipalitiesCollection(getDb()), ...constraints));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const nextCursor =
    snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null;
  return { items, nextCursor };
}
```

Note: the prefix upper bound uses `` (matching `searchMunicipalities`'s existing private-use sentinel — copy whatever char that file already uses; the source shows `key + ''` rendered, which is ``).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared test municipalityPage`
Expected: PASS (5 tests).

- [ ] **Step 5: Build shared + commit**

Run: `pnpm shared:build`
```bash
git add packages/shared/src/services/municipalityService.ts packages/shared/test/services/municipalityPage.test.ts
git commit -m "feat(shared): add listMunicipalitiesPage cursor pagination"
```

---

### Task 2: `useVillageHome` data hook

**Files:**
- Create: `apps/mobile/lib/useVillageHome.ts`
- Test: `apps/mobile/lib/__tests__/useVillageHome.test.ts` (create)

**Interfaces:**
- Consumes: `getMunicipality, getBarrios, getPlaces` (municipalityService); `isVillageAdmin, getVillageMembers` (villageMemberService); `getOrganizationsByMunicipality` (organizationService); `getOrgMemberCount` (orgMemberService); `getMyOrganizerRequests` (organizerRequestService); `getEventsByMunicipality` (eventService); `withFirestoreErrorLog`; `useAuth`.
- Produces:
  ```ts
  export interface VillageHomeState {
    loading: boolean;
    loadError: string | null;
    village: (MunicipalityData & { id: string }) | null;
    villageAdmin: boolean;
    isMember: boolean;
    barrios: (BarrioData & { id: string })[];
    places: (PlaceData & { id: string })[];
    organizations: (OrganizationData & { id: string })[];
    orgMemberCounts: Record<string, number>;
    events: (EventData & { id: string })[];
    peopleCount: number;
    pendingOrganizerRequest: boolean;
  }
  export function useVillageHome(municipalityId: string | null): VillageHomeState & { reload: () => Promise<void> };
  ```

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/lib/__tests__/useVillageHome.test.ts`. Mock the shared services and `useAuth`, render the hook with `@testing-library/react-native`'s `renderHook`, and assert the aggregated state. (Match the mocking style already used in `apps/mobile/app/(tabs)/__tests__/village.test.tsx` — reuse its service-mock setup as reference.)

```ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useVillageHome } from '../useVillageHome';

jest.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, profile: null, profileChecked: true }),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipality: jest.fn(async () => ({
    id: 'm1', name: 'Anaya', province: 'Segovia', communityActive: true,
    community: { adminUserId: null, description: null, coverImages: [] },
  })),
  getBarrios: jest.fn(async () => [{ id: 'b1', name: 'Centro', status: 'approved' }]),
  getPlaces: jest.fn(async () => []),
}));
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  isVillageAdmin: jest.fn(async () => false),
  getVillageMembers: jest.fn(async () => [{ userId: 'u1' }, { userId: 'u2' }]),
}));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getOrganizationsByMunicipality: jest.fn(async () => []),
}));
jest.mock('@cultuvilla/shared/services/orgMemberService', () => ({
  getOrgMemberCount: jest.fn(async () => 0),
}));
jest.mock('@cultuvilla/shared/services/organizerRequestService', () => ({
  getMyOrganizerRequests: jest.fn(async () => []),
}));
jest.mock('@cultuvilla/shared/services/eventService', () => ({
  getEventsByMunicipality: jest.fn(async () => []),
}));

describe('useVillageHome', () => {
  it('aggregates village data and derives isMember + peopleCount', async () => {
    const { result } = renderHook(() => useVillageHome('m1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.village?.name).toBe('Anaya');
    expect(result.current.isMember).toBe(true);   // u1 is in members
    expect(result.current.peopleCount).toBe(2);
    expect(result.current.barrios).toHaveLength(1);
  });

  it('returns empty state for a null municipalityId', async () => {
    const { result } = renderHook(() => useVillageHome(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.village).toBeNull();
    expect(result.current.isMember).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter mobile test useVillageHome`
Expected: FAIL — cannot find module `../useVillageHome`.

- [ ] **Step 3: Implement the hook**

Create `apps/mobile/lib/useVillageHome.ts`. This is a near-verbatim move of `loadVillage` from `apps/mobile/app/(tabs)/village.tsx:76-167`, generalised over a passed `municipalityId` and exposing `loading`.

```ts
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './auth/useAuth';
import { withFirestoreErrorLog } from './firestoreErrorLog';
import {
  getMunicipality,
  getBarrios,
  getPlaces,
} from '@cultuvilla/shared/services/municipalityService';
import {
  isVillageAdmin,
  getVillageMembers,
} from '@cultuvilla/shared/services/villageMemberService';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import { getOrgMemberCount } from '@cultuvilla/shared/services/orgMemberService';
import { getMyOrganizerRequests } from '@cultuvilla/shared/services/organizerRequestService';
import { getEventsByMunicipality } from '@cultuvilla/shared/services/eventService';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { BarrioData, PlaceData } from '@cultuvilla/shared/models/municipality';
import type { OrganizationData } from '@cultuvilla/shared/models/organization';
import type { EventData } from '@cultuvilla/shared/models/event';

export interface VillageHomeState {
  loading: boolean;
  loadError: string | null;
  village: (MunicipalityData & { id: string }) | null;
  villageAdmin: boolean;
  isMember: boolean;
  barrios: (BarrioData & { id: string })[];
  places: (PlaceData & { id: string })[];
  organizations: (OrganizationData & { id: string })[];
  orgMemberCounts: Record<string, number>;
  events: (EventData & { id: string })[];
  peopleCount: number;
  pendingOrganizerRequest: boolean;
}

const EMPTY: VillageHomeState = {
  loading: false,
  loadError: null,
  village: null,
  villageAdmin: false,
  isMember: false,
  barrios: [],
  places: [],
  organizations: [],
  orgMemberCounts: {},
  events: [],
  peopleCount: 0,
  pendingOrganizerRequest: false,
};

export function useVillageHome(municipalityId: string | null) {
  const { user } = useAuth();
  const [state, setState] = useState<VillageHomeState>({ ...EMPTY, loading: !!municipalityId });

  const reload = useCallback(async () => {
    if (!municipalityId) {
      setState({ ...EMPTY });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      const [mun, isAdmin, myReqs, bar, plc, members, evts] = await Promise.all([
        withFirestoreErrorLog('villageHome:getMunicipality', () => getMunicipality(municipalityId)),
        user
          ? withFirestoreErrorLog('villageHome:isVillageAdmin', () => isVillageAdmin(municipalityId, user.uid))
          : Promise.resolve(false),
        user
          ? withFirestoreErrorLog('villageHome:getMyOrganizerRequests', () => getMyOrganizerRequests(user.uid))
          : Promise.resolve([]),
        withFirestoreErrorLog('villageHome:getBarrios', () => getBarrios(municipalityId)),
        withFirestoreErrorLog('villageHome:getPlaces', () => getPlaces(municipalityId)),
        withFirestoreErrorLog('villageHome:getVillageMembers', () => getVillageMembers(municipalityId)),
        withFirestoreErrorLog('villageHome:getEvents', () =>
          getEventsByMunicipality(municipalityId, 'published'),
        ),
      ]);

      const orgs = await withFirestoreErrorLog('villageHome:getOrganizations', () =>
        getOrganizationsByMunicipality(municipalityId),
      );

      const now = new Date();
      const upcoming = evts.filter((e) => e.startDate >= now);

      const counts = await Promise.all(
        orgs.map((o) =>
          withFirestoreErrorLog('villageHome:getOrgMemberCount', () => getOrgMemberCount(o.id)),
        ),
      );
      const countByOrg: Record<string, number> = {};
      orgs.forEach((o, i) => {
        countByOrg[o.id] = counts[i] ?? 0;
      });

      setState({
        loading: false,
        loadError: null,
        village: mun,
        villageAdmin: isAdmin,
        isMember: !!user && members.some((m) => m.userId === user.uid),
        barrios: bar,
        places: plc,
        organizations: orgs,
        orgMemberCounts: countByOrg,
        events: upcoming,
        peopleCount: members.length,
        pendingOrganizerRequest: myReqs.some(
          (r) => r.municipalityId === municipalityId && r.status === 'pending',
        ),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[useVillageHome] reload ERR', msg);
      setState((s) => ({ ...s, loading: false, loadError: msg }));
    }
  }, [municipalityId, user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { ...state, reload };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter mobile test useVillageHome`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/useVillageHome.ts apps/mobile/lib/__tests__/useVillageHome.test.ts
git commit -m "feat(mobile): extract useVillageHome data hook"
```

---

### Task 3: `<VillageHomeBody>` presentational component

**Files:**
- Create: `apps/mobile/components/feature/VillageHomeBody.tsx`
- Test: `apps/mobile/components/feature/__tests__/VillageHomeBody.test.tsx` (create)

**Interfaces:**
- Consumes: `VillageHomeState` (from `lib/useVillageHome`); `VillageSections` exports (ACCENT, Stat, StatSeparator, Section, EntityCard); `VillageInfoModal`; `useAuth`, `useIsAppAdmin`, `useShareDeepLink`, `useT`; `addVillageMember` (villageMemberService); `getVillageViewLink, getVillageInviteLink` (deepLinkService); `isProposalVisible` (lib/proposals); `formatDate`; `escudoFullUrl, hasManualEscudo` (MunicipalityDataModel).
- Produces:
  ```ts
  export interface VillageHomeBodyProps {
    data: VillageHomeState;
    reload: () => Promise<void> | void;
    /** Pushed-detail invite deep-link: show the "you were invited" line above join. */
    arrivedViaInvite?: boolean;
  }
  export function VillageHomeBody(props: VillageHomeBodyProps): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/components/feature/__tests__/VillageHomeBody.test.tsx`. Mock the context hooks and `addVillageMember`; render with hand-built `VillageHomeState` fixtures.

```tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { VillageHomeBody } from '../VillageHomeBody';
import type { VillageHomeState } from '../../../lib/useVillageHome';

jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, profile: null, profileChecked: true }),
}));
jest.mock('../../../lib/auth/useIsAppAdmin', () => ({ useIsAppAdmin: () => ({ isAppAdmin: false }) }));
jest.mock('../../../lib/deeplink/useShareDeepLink', () => ({ useShareDeepLink: () => jest.fn() }));
const addVillageMember = jest.fn(async () => undefined);
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  addVillageMember: (...a: unknown[]) => addVillageMember(...a),
}));

const base: VillageHomeState = {
  loading: false, loadError: null,
  village: {
    id: 'm1', name: 'Anaya', province: 'Segovia', communityActive: true,
    community: { adminUserId: null, description: null, coverImages: [] },
  } as any,
  villageAdmin: false, isMember: true,
  barrios: [], places: [], organizations: [], orgMemberCounts: {},
  events: [], peopleCount: 3, pendingOrganizerRequest: false,
};

describe('VillageHomeBody', () => {
  it('hides the join CTA for a member', () => {
    const { queryByText } = render(<VillageHomeBody data={base} reload={jest.fn()} />);
    expect(queryByText('Unirme a este pueblo')).toBeNull();
  });

  it('shows the join CTA for a non-member and joins on confirm', async () => {
    const reload = jest.fn();
    const { getByText } = render(
      <VillageHomeBody data={{ ...base, isMember: false }} reload={reload} />,
    );
    fireEvent.press(getByText('Unirme a este pueblo'));
    // On the jest (native) path Alert.alert is mocked; invoke its confirm button.
    // (If using window.confirm path, stub window.confirm to return true instead.)
    await waitFor(() => expect(addVillageMember).toHaveBeenCalledWith('m1', 'u1'));
  });

  it('renders the start-village notice when the community is dormant', () => {
    const dormant = { ...base, village: { ...base.village!, communityActive: false } };
    const { getByText } = render(<VillageHomeBody data={dormant as any} reload={jest.fn()} />);
    expect(getByText('Iniciar este pueblo')).toBeTruthy();
  });
});
```

(For the confirm path: the existing `village/[villageId]/index.tsx` uses `Platform.OS === 'web' ? window.confirm : Alert.alert`. In jest, `Platform.OS` is `'ios'`, so mock `Alert.alert` to auto-press the confirm button — copy the Alert-mock approach from `village.test.tsx` if present, else `jest.spyOn(Alert, 'alert').mockImplementation((_t,_b,btns)=>btns?.find(x=>x.text!=='Cancelar')?.onPress?.())`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter mobile test VillageHomeBody`
Expected: FAIL — cannot find module `../VillageHomeBody`.

- [ ] **Step 3: Implement the component**

Create `apps/mobile/components/feature/VillageHomeBody.tsx`. The render body is moved from `apps/mobile/app/(tabs)/village.tsx` (the `loading/error/!village/!communityActive/full-home` branches + the join CTA from `village/[villageId]/index.tsx`). The header chrome (`AppHeader`) is NOT included — the host supplies it.

```tsx
import { useState } from 'react';
import { ActivityIndicator, Image, Platform, Alert, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, VStack, HStack, Pressable, Escudo, Button } from '../primitives';
import { VillageInfoModal } from './VillageInfoModal';
import {
  ACCENT,
  Stat,
  StatSeparator,
  Section,
  EntityCard,
} from './VillageSections';
import { useAuth } from '../../lib/auth/useAuth';
import { useIsAppAdmin } from '../../lib/auth/useIsAppAdmin';
import { useShareDeepLink } from '../../lib/deeplink/useShareDeepLink';
import { useT } from '../../lib/i18n';
import { isProposalVisible } from '../../lib/proposals';
import { addVillageMember } from '@cultuvilla/shared/services/villageMemberService';
import {
  getVillageViewLink,
  getVillageInviteLink,
} from '@cultuvilla/shared/services/deepLinkService';
import { formatDate } from '@cultuvilla/shared/utils';
import {
  escudoFullUrl,
  hasManualEscudo,
} from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { VillageHomeState } from '../../lib/useVillageHome';

export interface VillageHomeBodyProps {
  data: VillageHomeState;
  reload: () => Promise<void> | void;
  arrivedViaInvite?: boolean;
}

export function VillageHomeBody({ data, reload, arrivedViaInvite = false }: VillageHomeBodyProps) {
  const { user } = useAuth();
  const { isAppAdmin } = useIsAppAdmin();
  const share = useShareDeepLink();
  const { t } = useT();
  const [infoOpen, setInfoOpen] = useState(false);
  const [joining, setJoining] = useState(false);

  const { loading, loadError, village } = data;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }
  if (loadError) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text tone="danger">{loadError}</Text>
      </View>
    );
  }
  if (!village) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  // Dormant municipality: offer the self-service "start this village" flow.
  if (!village.communityActive) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <VStack gap={2} className="items-center">
          <Escudo url={escudoFullUrl(village)} size={96} fallbackInitial={village.name} />
          <Text variant="h2" className="mt-2 text-center">{village.name}</Text>
          <Text tone="muted" variant="bodySm">{village.province}</Text>
          <Text className="text-center mt-4">{t('village.notRegistered.body')}</Text>
          <Text variant="h3" className="text-center mt-2">{t('village.notRegistered.cta')}</Text>
          <Button className="mt-4" onPress={() => router.push(`/discover/start/${village.id}` as never)}>
            {t('village.notRegistered.button')}
          </Button>
        </VStack>
      </View>
    );
  }

  const { villageAdmin, isMember, barrios, places, organizations, orgMemberCounts, events, peopleCount, pendingOrganizerRequest } = data;
  const canManage = isAppAdmin || villageAdmin;
  const noOrganizer = village.community?.adminUserId == null;
  const villageBase = `/village/${village.id}` as const;
  const cover = village.community?.coverImages?.[0] ?? null;

  const caps = { canManage, uid: user?.uid ?? null };
  const visibleBarrios = barrios.filter((b) => isProposalVisible(b.status, b.proposedBy, caps));
  const visiblePlaces = places.filter((p) => isProposalVisible(p.status, p.proposedBy, caps));
  const visibleOrgs = organizations.filter((o) => isProposalVisible(o.status, o.requestedBy, caps));
  const penas = visibleOrgs.filter((o) => o.type === 'peña');
  const agrupaciones = visibleOrgs.filter((o) => o.type !== 'peña');

  const onJoin = () => {
    if (!user) {
      router.push('/(auth)/login' as never);
      return;
    }
    const title = t('village.joinConfirm.title');
    const body = t('village.joinConfirm.body');
    const doJoin = async () => {
      setJoining(true);
      try {
        await addVillageMember(village.id, user.uid);
        await reload();
      } finally {
        setJoining(false);
      }
    };
    // react-native-web 0.21 ships Alert.alert as a no-op; use window.confirm on web.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`)) void doJoin();
      return;
    }
    Alert.alert(title, body, [
      { text: t('village.joinConfirm.cancel'), style: 'cancel' },
      { text: t('village.joinConfirm.confirm'), onPress: () => void doJoin() },
    ]);
  };

  return (
    <>
      <ScrollView contentContainerClassName="pb-10">
        {cover ? <Image source={{ uri: cover }} className="w-full h-40" resizeMode="cover" /> : null}
        <VStack gap={2} className="px-4 pt-4">
          <HStack gap={3} className="items-center">
            <View className={`bg-surface rounded-2xl shadow-sm ${hasManualEscudo(village) ? '' : 'p-2'}`}>
              <Escudo url={escudoFullUrl(village)} size={88} fill={hasManualEscudo(village)} fallbackInitial={village.name} />
            </View>
            <VStack gap={0} className="flex-1">
              <HStack gap={2} className="items-center">
                <Text variant="h1">{village.name}</Text>
                <Pressable onPress={() => setInfoOpen(true)} accessibilityLabel={t('village.info.title')} className="p-1">
                  <Ionicons name="information-circle-outline" size={24} color={ACCENT} />
                </Pressable>
              </HStack>
              <Text tone="muted" variant="bodySm">{village.province}</Text>
            </VStack>
          </HStack>

          {noOrganizer && isMember && !canManage ? (
            <Pressable
              onPress={() => router.push(`/village/${village.id}/edit-info` as never)}
              accessibilityLabel={t('village.admin.overview.edit')}
              className="flex-row items-center"
            >
              <Ionicons name="create-outline" size={16} color={ACCENT} />
              <Text variant="bodySm" style={{ color: ACCENT }} className="ml-1 font-medium">
                {t('village.admin.overview.edit')}
              </Text>
            </Pressable>
          ) : null}
        </VStack>

        {/* Self-join CTA — only for non-members (never shows on the active tab). */}
        {!isMember ? (
          <VStack gap={1} className="px-4 pt-3">
            {arrivedViaInvite ? (
              <Text tone="muted" variant="bodySm" className="text-center">{t('village.invitedBanner')}</Text>
            ) : null}
            <Pressable
              onPress={onJoin}
              disabled={joining}
              accessibilityLabel={t('village.join')}
              className="bg-primary rounded-lg p-3 items-center"
            >
              <Text tone="onAccent">{user ? t('village.join') : t('village.signInToJoin')}</Text>
            </Pressable>
          </VStack>
        ) : null}

        {/* No-organizer wiki banner */}
        {noOrganizer ? (
          <View className="mx-4 mt-3 p-3 rounded-lg border border-subtle bg-surface">
            <Text variant="bodySm">{t('village.noOrganizer.body')}</Text>
            {pendingOrganizerRequest ? (
              <Text tone="muted" variant="bodySm" className="mt-1">{t('village.noOrganizer.pending')}</Text>
            ) : (
              <Pressable onPress={() => router.push(`/discover/organize/${village.id}` as never)} className="mt-2 flex-row items-center">
                <Ionicons name="ribbon-outline" size={16} color={ACCENT} />
                <Text variant="bodySm" style={{ color: ACCENT }} className="ml-1 font-medium">{t('village.noOrganizer.cta')}</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        <HStack className="items-center justify-center py-5">
          <Stat value={peopleCount} label={t('village.admin.overview.people')} />
          <StatSeparator />
          <Stat value={penas.length} label={t('village.hub.penas')} />
          <StatSeparator />
          <Stat value={places.length} label={t('village.admin.hub.places')} />
        </HStack>

        <HStack gap={3} className="px-4 pb-2">
          <Pressable
            onPress={() => void share(getVillageViewLink(village.id), village.name)}
            accessibilityLabel={t('village.share.title')}
            className="flex-1 flex-row items-center justify-center bg-surface"
            style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 24, borderWidth: 1.5, borderColor: ACCENT, minHeight: 32 }}
          >
            <Text style={{ color: ACCENT }} className="font-semibold">{t('village.share.title')}</Text>
          </Pressable>
          <Pressable
            onPress={() => void share(getVillageInviteLink(village.id), village.name)}
            accessibilityLabel={t('village.invite.title')}
            className="flex-1 flex-row items-center justify-center bg-surface"
            style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 24, borderWidth: 1.5, borderColor: ACCENT, minHeight: 32 }}
          >
            <Text style={{ color: ACCENT }} className="font-semibold">{t('village.invite.title')}</Text>
          </Pressable>
        </HStack>

        <Section title={t('village.upcomingEvents.title')} isEmpty={events.length === 0} emptyLabel={t('village.upcomingEvents.empty')}>
          {events.map((e) => (
            <EntityCard key={e.id} label={e.title} sub={formatDate(e.startDate, 'short')} icon="calendar-outline" imageUri={e.imageURL ?? e.municipalityCoverImage} onPress={() => router.push(`/event/${e.id}` as never)} />
          ))}
        </Section>

        <Section title={t('village.admin.hub.barrios')} isEmpty={visibleBarrios.length === 0} emptyLabel={t('village.admin.barrios.empty')} addLabel={canManage ? t('village.admin.barrios.add') : t('village.proposals.propose')} onAdd={() => router.push(`${villageBase}/barrios` as never)}>
          {visibleBarrios.map((b) => (
            <EntityCard key={b.id} label={b.name} sub={b.status === 'pending' ? t('village.proposals.pending') : undefined} icon="map-outline" imageUri={b.imageURL} onPress={() => router.push(`/village/${village.id}/barrio/${b.id}` as never)} />
          ))}
        </Section>

        <Section title={t('village.admin.hub.places')} isEmpty={visiblePlaces.length === 0} emptyLabel={t('village.admin.places.empty')} addLabel={canManage ? t('village.admin.places.add') : t('village.proposals.propose')} onAdd={() => router.push(`${villageBase}/places` as never)}>
          {visiblePlaces.map((p) => (
            <EntityCard key={p.id} label={p.name} sub={p.status === 'pending' ? t('village.proposals.pending') : undefined} icon="location-outline" imageUri={p.imageURL} onPress={() => router.push(`/village/${village.id}/place/${p.id}` as never)} />
          ))}
        </Section>

        <Section title={t('village.hub.organizations')} onManage={() => router.push(`${villageBase}/organizations` as never)} isEmpty={agrupaciones.length === 0} emptyLabel={t('village.organizationsList.empty')} addLabel={canManage ? t('village.admin.organizations.add') : t('village.proposals.propose')} onAdd={() => router.push(`${villageBase}/organizations` as never)}>
          {agrupaciones.map((o) => (
            <EntityCard key={o.id} label={o.name} sub={t('village.hub.memberCount', { count: orgMemberCounts[o.id] ?? 0 })} icon="business-outline" imageUri={o.imageURL} onPress={() => router.push(`/o/${o.id}` as never)} />
          ))}
        </Section>

        <Section title={t('village.hub.penas')} onManage={() => router.push(`${villageBase}/organizations` as never)} isEmpty={penas.length === 0} emptyLabel={t('village.organizationsList.penasEmpty')} addLabel={canManage ? t('village.admin.organizations.add') : t('village.proposals.propose')} onAdd={() => router.push(`${villageBase}/organizations` as never)}>
          {penas.map((o) => (
            <EntityCard key={o.id} label={o.name} sub={t('village.hub.memberCount', { count: orgMemberCounts[o.id] ?? 0 })} icon="people-circle-outline" imageUri={o.imageURL} onPress={() => router.push(`/o/${o.id}` as never)} />
          ))}
        </Section>

        <View className="px-4 pt-6">
          <Button variant="secondary" onPress={() => router.push(`/village/${village.id}/censo` as never)}>
            {t('village.censo.link')}
          </Button>
        </View>
      </ScrollView>

      <VillageInfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} village={village} canManage={canManage} />
    </>
  );
}
```

Note: this preserves the resolved tab state — `onManage` kept on Agrupaciones/Peñas, omitted on Barrios/Lugares (matches `main` after the stash resolution). Keep them identical so the tab is visually unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter mobile test VillageHomeBody`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feature/VillageHomeBody.tsx apps/mobile/components/feature/__tests__/VillageHomeBody.test.tsx
git commit -m "feat(mobile): extract VillageHomeBody presentational component"
```

---

### Task 4: Refactor the pueblo tab onto the hook + body

**Files:**
- Modify: `apps/mobile/app/(tabs)/village.tsx` (replace most of it)
- Test: `apps/mobile/app/(tabs)/__tests__/village.test.tsx` (retarget assertions if needed)

**Interfaces:**
- Consumes: `useVillageHome` (Task 2), `VillageHomeBody` (Task 3), `AppHeader`, `Screen`, `VillageDiscovery`.
- Produces: behaviour-identical pueblo tab.

- [ ] **Step 1: Replace the tab implementation**

Rewrite `apps/mobile/app/(tabs)/village.tsx` to:
```tsx
import { ActivityIndicator, View } from 'react-native';
import { Screen } from '../../components/primitives';
import { AppHeader } from '../../components/layout/AppHeader';
import { VillageDiscovery } from '../../components/feature/VillageDiscovery';
import { VillageHomeBody } from '../../components/feature/VillageHomeBody';
import { useVillageHome } from '../../lib/useVillageHome';
import { useAuth } from '../../lib/auth/useAuth';

export default function VillageTabScreen() {
  const { profile, profileChecked } = useAuth();
  const activeMunicipalityId = profile?.activeMunicipalityId ?? null;
  const home = useVillageHome(activeMunicipalityId);

  if (!profileChecked) {
    return (
      <Screen padded={false} topInset={false} bottomInset={false}>
        <AppHeader />
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      </Screen>
    );
  }

  if (!activeMunicipalityId) {
    return (
      <Screen padded={false} topInset={false} bottomInset={false}>
        <AppHeader />
        <VillageDiscovery />
      </Screen>
    );
  }

  return (
    <Screen padded={false} topInset={false} bottomInset={false}>
      <AppHeader centerLabel={home.village?.name} />
      <VillageHomeBody data={home} reload={home.reload} />
    </Screen>
  );
}
```

- [ ] **Step 2: Run the existing tab test**

Run: `pnpm --filter mobile test village.test`
Expected: It may fail if it asserted on internals now moved. Update the test's service mocks to match the ones `useVillageHome` calls (same service names — likely already aligned), and assert on rendered output (village name, sections) rather than internal state. Keep coverage for: active village renders home; no `activeMunicipalityId` renders discovery.

- [ ] **Step 3: Make the tab test pass**

Adjust assertions/mocks as needed (no production change beyond Step 1). Re-run until green.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter mobile exec tsc --noEmit` (or repo's `pnpm check` typecheck step)
Expected: no errors in `village.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(tabs)/village.tsx apps/mobile/app/(tabs)/__tests__/village.test.tsx
git commit -m "refactor(mobile): pueblo tab consumes useVillageHome + VillageHomeBody"
```

---

### Task 5: Rebuild the pushed `/village/[villageId]` detail

**Files:**
- Modify: `apps/mobile/app/village/[villageId]/index.tsx` (replace)
- Test: `apps/mobile/app/village/[villageId]/__tests__/index.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `useVillageHome`, `VillageHomeBody`, `Screen`, `ScreenHeader`, `useLocalSearchParams`.
- Produces: a back-navigable village home reusing the body, with the invite-deep-link banner.

- [ ] **Step 1: Replace the screen**

```tsx
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { VillageHomeBody } from '../../../components/feature/VillageHomeBody';
import { useVillageHome } from '../../../lib/useVillageHome';

export default function VillageHome() {
  const { villageId, intent } = useLocalSearchParams<{ villageId: string; intent?: string }>();
  const arrivedViaInvite = intent === 'join';
  const home = useVillageHome((villageId as string) ?? null);

  return (
    <Screen padded={false} topInset={false}>
      <ScreenHeader title={home.village?.name} />
      <VillageHomeBody data={home} reload={home.reload} arrivedViaInvite={arrivedViaInvite} />
    </Screen>
  );
}
```

This removes the bespoke join flow / hubActions / EventCard list — all now provided by the body. The share/invite header buttons move into the body's share/invite row (already present). The invite banner is preserved via `arrivedViaInvite`.

- [ ] **Step 2: Write a smoke test**

Create `apps/mobile/app/village/[villageId]/__tests__/index.test.tsx`: mock `useVillageHome` to return an active village + `useLocalSearchParams` to `{ villageId: 'm1' }`; assert the screen renders the village name in a `ScreenHeader` (back button present) and the body. Mock the body or the underlying services as the lightest path.

```tsx
import { render } from '@testing-library/react-native';
jest.mock('../../../../lib/useVillageHome', () => ({
  useVillageHome: () => ({
    loading: false, loadError: null,
    village: { id: 'm1', name: 'Anaya', province: 'Segovia', communityActive: true, community: { adminUserId: null, coverImages: [] } },
    villageAdmin: false, isMember: true, barrios: [], places: [], organizations: [],
    orgMemberCounts: {}, events: [], peopleCount: 1, pendingOrganizerRequest: false,
    reload: jest.fn(),
  }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1' }),
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: jest.fn(),
}));
import VillageHome from '../index';

it('renders the village name in the header', () => {
  const { getAllByText } = render(<VillageHome />);
  expect(getAllByText('Anaya').length).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter mobile test "village/\\[villageId\\]"`
Expected: PASS.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter mobile exec tsc --noEmit`
Expected: no errors. (Removed imports — `EventCard`, `getEventsByMunicipality`, etc. — must be gone.)

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/village/[villageId]/index.tsx" "apps/mobile/app/village/[villageId]/__tests__/index.test.tsx"
git commit -m "feat(mobile): pushed village detail reuses VillageHomeBody with back nav"
```

---

### Task 6: Discovery rework — groups, infinite scroll, badges

**Files:**
- Modify: `apps/mobile/components/feature/VillageDiscovery.tsx` (replace)
- Modify: `packages/i18n/messages/es.json` (add discover keys)
- Test: `apps/mobile/components/feature/__tests__/VillageDiscovery.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `getActiveCommunities`, `listMunicipalitiesPage` (Task 1).
- Produces: a search + "Municipios activos" + infinite-scroll "Todos" discovery list.

- [ ] **Step 1: Add i18n keys**

In `packages/i18n/messages/es.json`, under `discover`, replace `notSeeing` and add group/badge labels:
```json
"discover": {
  "title": "Buscar pueblo",
  "search": "Busca tu pueblo",
  "empty": "No hay pueblos activos todavía",
  "inactive": "Sin comunidad activa",
  "activeGroup": "Municipios activos",
  "allGroup": "Todos",
  "activeBadge": "Activo",
  "loadingMore": "Cargando…"
}
```
(Remove `notSeeing` — nothing references it after this task. Verify with `grep -rn "discover.notSeeing\|notSeeing" apps packages`.)

- [ ] **Step 2: Write the failing test**

Create `apps/mobile/components/feature/__tests__/VillageDiscovery.test.tsx`. Mock the two services; assert the active group renders, "Todos" renders the first page, tapping an active village pushes `/village/[villageId]`, and a dormant one pushes `/discover/start/[municipalityId]`.

```tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
const push = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => push(...a) } }));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getActiveCommunities: jest.fn(async () => [
    { id: 'm1', name: 'Anaya', province: 'Segovia', communityActive: true },
  ]),
  listMunicipalitiesPage: jest.fn(async () => ({
    items: [
      { id: 'm1', name: 'Anaya', province: 'Segovia', communityActive: true },
      { id: 'm2', name: 'Bernuy', province: 'Segovia', communityActive: false },
    ],
    nextCursor: null,
  })),
}));
import { VillageDiscovery } from '../VillageDiscovery';

beforeEach(() => push.mockClear());

it('opens an active village detail on tap', async () => {
  const { getAllByText } = render(<VillageDiscovery />);
  await waitFor(() => expect(getAllByText('Anaya').length).toBeGreaterThan(0));
  fireEvent.press(getAllByText('Anaya')[0]);
  expect(push).toHaveBeenCalledWith(
    expect.objectContaining({ pathname: '/village/[villageId]', params: { villageId: 'm1' } }),
  );
});

it('routes a dormant municipality to the start flow', async () => {
  const { getByText } = render(<VillageDiscovery />);
  await waitFor(() => expect(getByText('Bernuy')).toBeTruthy());
  fireEvent.press(getByText('Bernuy'));
  expect(push).toHaveBeenCalledWith(
    expect.objectContaining({ pathname: '/discover/start/[municipalityId]', params: { municipalityId: 'm2' } }),
  );
});
```

- [ ] **Step 2b: Run test to verify it fails**

Run: `pnpm --filter mobile test VillageDiscovery`
Expected: FAIL (still the old `showAll` UI / `searchMunicipalities` import).

- [ ] **Step 3: Rewrite `VillageDiscovery`**

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ActivityIndicator, View } from 'react-native';
import { router, type Href } from 'expo-router';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { VStack, HStack, Text, Input, Escudo, Pressable } from '../primitives';
import { useT } from '../../lib/i18n';
import {
  getActiveCommunities,
  listMunicipalitiesPage,
} from '@cultuvilla/shared/services/municipalityService';
import { escudoThumbDisplayUrl } from '@cultuvilla/shared/models/municipality';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality';

type Muni = MunicipalityData & { id: string };
const PAGE_SIZE = 20;

// Two-section list rendered through one FlatList: a fixed "Municipios activos"
// group (filtered client-side) followed by the cursor-paginated "Todos" group.
type Row =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'muni'; key: string; muni: Muni; group: 'active' | 'all' };

export function VillageDiscovery() {
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<Muni[] | null>(null);
  const [all, setAll] = useState<Muni[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    void getActiveCommunities()
      .then(setActive)
      .catch((e) => console.log('[VillageDiscovery] getActiveCommunities ERR', e?.code, e?.message));
  }, []);

  // (Re)seed the "Todos" list whenever the search term changes (debounced).
  useEffect(() => {
    const myReq = ++reqId.current;
    const handle = setTimeout(async () => {
      const page = await listMunicipalitiesPage({ search, limit: PAGE_SIZE });
      if (reqId.current !== myReq) return; // a newer search superseded this one
      setAll(page.items);
      setCursor(page.nextCursor);
      setExhausted(page.nextCursor === null);
    }, 200);
    return () => clearTimeout(handle);
  }, [search]);

  const loadMore = useCallback(async () => {
    if (loadingMore || exhausted || !cursor) return;
    setLoadingMore(true);
    const myReq = reqId.current;
    try {
      const page = await listMunicipalitiesPage({ search, cursor, limit: PAGE_SIZE });
      if (reqId.current !== myReq) return;
      setAll((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
      setExhausted(page.nextCursor === null);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, exhausted, cursor, search]);

  const activeFiltered = useMemo(() => {
    if (!active) return [];
    const q = search.trim().toLowerCase();
    return q ? active.filter((m) => m.name.toLowerCase().includes(q)) : active;
  }, [active, search]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    if (activeFiltered.length > 0) {
      out.push({ kind: 'header', key: 'h-active', label: t('discover.activeGroup') });
      activeFiltered.forEach((m) => out.push({ kind: 'muni', key: `active-${m.id}`, muni: m, group: 'active' }));
    }
    out.push({ kind: 'header', key: 'h-all', label: t('discover.allGroup') });
    all.forEach((m) => out.push({ kind: 'muni', key: `all-${m.id}`, muni: m, group: 'all' }));
    return out;
  }, [activeFiltered, all, t]);

  if (active === null) {
    return (
      <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
    );
  }

  const openMuni = (m: Muni) => {
    const target: Href = m.communityActive
      ? { pathname: '/village/[villageId]', params: { villageId: m.id } }
      : { pathname: '/discover/start/[municipalityId]', params: { municipalityId: m.id } };
    router.push(target);
  };

  return (
    <View className="flex-1">
      <View className="p-4">
        <Input label={t('discover.search')} value={search} onChangeText={setSearch} autoCapitalize="none" />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerClassName="px-4 pb-8 gap-3"
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={<Text tone="muted">{t('discover.empty')}</Text>}
        ListFooterComponent={loadingMore ? <View className="py-3"><ActivityIndicator /></View> : null}
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return <Text variant="h3" className="pt-2" style={{ color: '#bb5d3a' }}>{item.label}</Text>;
          }
          const m = item.muni;
          return (
            <Pressable
              onPress={() => openMuni(m)}
              className={`w-full rounded-md border bg-surface px-4 py-3 ${m.communityActive ? 'border-accent' : 'border-subtle'}`}
            >
              <HStack gap={3} className="items-center">
                <Escudo url={escudoThumbDisplayUrl(m)} size={40} fallbackInitial={m.name} />
                <VStack gap={1} className="flex-1">
                  <Text>{m.name}</Text>
                  <Text tone="muted" variant="bodySm">{m.province}</Text>
                </VStack>
                <Text variant="bodySm" tone={m.communityActive ? undefined : 'muted'} style={m.communityActive ? { color: '#bb5d3a' } : undefined}>
                  {m.communityActive ? t('discover.activeBadge') : t('discover.inactive')}
                </Text>
              </HStack>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter mobile test VillageDiscovery`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify no stale references + typecheck**

Run: `grep -rn "notSeeing\|searchMunicipalities\|showAll" apps/mobile/components/feature/VillageDiscovery.tsx` → expect no matches.
Run: `pnpm shared:build && pnpm --filter mobile exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/feature/VillageDiscovery.tsx apps/mobile/components/feature/__tests__/VillageDiscovery.test.tsx packages/i18n/messages/es.json
git commit -m "feat(mobile): paginated discovery with active/dormant groups"
```

---

### Task 7: Full verification sweep + PR

**Files:** none (verification only).

- [ ] **Step 1: Web-compat check**

Run: `node scripts/check-mobile-web-compat.mjs` (or `pnpm check:web-compat` if defined)
Expected: PASS. The body's `Alert.alert` is guarded by `Platform.OS === 'web'` → `window.confirm`, so it passes without annotation.

- [ ] **Step 2: Lint + typecheck + tests (full)**

Run: `pnpm check`
Expected: all green (shared vitest, mobile jest, eslint, tsc). Fix any `no-unnecessary-condition` (drop redundant `?.` after narrowing) or unused-import errors surfaced by the refactor.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A && git commit -m "chore(mobile): verification fixups for village detail reuse"
```

- [ ] **Step 4: Push + open PR**

```bash
git push -u origin feat/village-detail-reuse
gh pr create --base main --head feat/village-detail-reuse --title "Reuse pueblo-tab home in discovery detail + paginated discovery" --body "<summary + decisions>"
```

---

## Self-Review

**Spec coverage:**
- Extract `useVillageHome` → Task 2. `<VillageHomeBody>` → Task 3. ✓
- Tab host (AppHeader) → Task 4; pushed detail host (ScreenHeader, back) → Task 5. ✓
- Join + admin parity; join CTA in body gated `!isMember` → Task 3. ✓
- Discovery: search top, "Municipios activos" + infinite-scroll "Todos", awakened/dormant badges, remove "Cargar todos" → Task 6. ✓
- `listMunicipalitiesPage` + `getActiveCommunities` kept → Task 1. ✓
- Tests: service vitest (Task 1), hook/body/tab/detail/discovery jest (Tasks 2–6). ✓

**Placeholder scan:** No TBD/TODO; every code step carries full code. ✓

**Type consistency:** `VillageHomeState` defined in Task 2, consumed unchanged in Tasks 3–5. `MunicipalitiesPage`/`listMunicipalitiesPage` signature defined in Task 1, consumed in Task 6. `nextCursor: QueryDocumentSnapshot | null` consistent across service and caller. ✓

**Open verification during execution:** confirm `Section`'s prop names (`onManage`/`onAdd`/`addLabel`/`isEmpty`/`emptyLabel`) and `EntityCard` props match `VillageSections.tsx` exactly when moving the JSX (they are copied verbatim from the current tab, so they already match).
