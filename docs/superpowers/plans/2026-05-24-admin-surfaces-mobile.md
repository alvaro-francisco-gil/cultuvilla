# Admin Surfaces on Mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the existing web admin surfaces into `apps/mobile/` as two clearly separated tiers: an "Administración" entry under Profile for app admins, and a header gear icon on the village screen for village admins.

**Architecture:** Two `_layout.tsx` route guards (one for `/admin/*`, one for `/village/[villageId]/admin/*`) plus render-time hiding of the entry points. All Firestore I/O goes through the existing `packages/shared/src/services/*` — no new shared logic. Screens reuse mobile primitives (`Button`, `Input`, `Card`, `Screen`, `Text`, etc.) and `ScreenHeader`.

**Tech Stack:** Expo Router, React Native, NativeWind, `@cultuvilla/shared` services, `@cultuvilla/i18n`, Jest + `@testing-library/react-native`, Ionicons.

**Reference:** spec at `docs/superpowers/specs/2026-05-24-admin-surfaces-mobile-design.md`.

---

## File Map

**New files:**
- `apps/mobile/lib/auth/useIsAppAdmin.ts` — hook
- `apps/mobile/app/admin/_layout.tsx` — app-admin route guard
- `apps/mobile/app/admin/index.tsx` — app-admin hub
- `apps/mobile/app/admin/activate-village.tsx`
- `apps/mobile/app/admin/organizer-requests.tsx`
- `apps/mobile/app/admin/occupations.tsx`
- `apps/mobile/app/village/[villageId]/admin/_layout.tsx` — village-admin route guard
- `apps/mobile/app/village/[villageId]/admin/index.tsx` — village-admin hub
- `apps/mobile/app/village/[villageId]/admin/barrios.tsx`
- `apps/mobile/app/village/[villageId]/admin/cemeteries.tsx`
- `apps/mobile/app/village/[villageId]/admin/organizations.tsx`
- `apps/mobile/app/village/[villageId]/admin/invite-tokens.tsx`
- `apps/mobile/app/village/[villageId]/admin/censo.tsx`
- `apps/mobile/app/village/[villageId]/admin/community.tsx`
- `apps/mobile/lib/auth/__tests__/useIsAppAdmin.test.tsx`

**Modified files:**
- `apps/mobile/app/(tabs)/profile.tsx` — add "Administración" row (admin-only)
- `apps/mobile/app/village/[villageId]/index.tsx` — add gear icon to header (admin-only)
- `packages/i18n/messages/es.json` — new `admin.*` and `village.admin.*` namespaces

---

## Task 1: i18n strings

**Files:**
- Modify: `packages/i18n/messages/es.json`

- [ ] **Step 1: Add the new namespaces**

Add these blocks at the top level (after the `auth` block) in `packages/i18n/messages/es.json`. Keep alphabetical-ish order of top-level keys consistent with what's there:

```json
"admin": {
  "title": "Administración",
  "profileEntry": "Administración",
  "hub": {
    "activateVillage": "Activar pueblo",
    "activateVillageHint": "Crear una comunidad en un municipio",
    "organizerRequests": "Solicitudes de organizador",
    "organizerRequestsHint": "Revisar pendientes",
    "occupations": "Ocupaciones",
    "occupationsHint": "Aprobadas y propuestas"
  },
  "activate": {
    "title": "Activar pueblo",
    "pickMunicipality": "Elige un municipio",
    "searchPlaceholder": "Buscar municipio…",
    "description": "Descripción",
    "submit": "Activar",
    "success": "Pueblo activado",
    "alreadyActive": "Este municipio ya tiene comunidad"
  },
  "organizerRequests": {
    "title": "Solicitudes de organizador",
    "empty": "No hay solicitudes pendientes",
    "approve": "Aprobar",
    "reject": "Rechazar"
  },
  "occupations": {
    "title": "Ocupaciones",
    "catalog": "Catálogo",
    "proposals": "Propuestas pendientes",
    "addName": "Nombre",
    "add": "Añadir ocupación",
    "approve": "Aprobar",
    "reject": "Rechazar",
    "noProposals": "Sin propuestas pendientes"
  }
},
"village": {
  "admin": {
    "open": "Administrar pueblo",
    "title": "Administración del pueblo",
    "hub": {
      "barrios": "Barrios",
      "cemeteries": "Cementerios",
      "organizations": "Organizaciones",
      "invites": "Invitaciones",
      "censo": "Censo",
      "community": "Comunidad",
      "joinRequests": "Solicitudes de unión"
    },
    "barrios": {
      "title": "Barrios",
      "add": "Añadir barrio",
      "name": "Nombre del barrio",
      "empty": "Aún no hay barrios"
    },
    "cemeteries": {
      "title": "Cementerios",
      "add": "Añadir cementerio",
      "name": "Nombre",
      "description": "Descripción",
      "empty": "Aún no hay cementerios"
    },
    "organizations": {
      "title": "Organizaciones",
      "empty": "Sin solicitudes pendientes",
      "approve": "Aprobar",
      "reject": "Rechazar"
    },
    "invites": {
      "title": "Invitaciones",
      "create": "Crear invitación",
      "copy": "Copiar enlace",
      "copied": "Copiado",
      "delete": "Eliminar",
      "empty": "No hay invitaciones activas"
    },
    "community": {
      "title": "Comunidad",
      "description": "Descripción",
      "saved": "Guardado"
    }
  }
}
```

- [ ] **Step 2: Run typecheck (the i18n package types its keys)**

Run: `pnpm i18n:typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "feat(i18n): add admin and village.admin namespaces"
```

---

## Task 2: `useIsAppAdmin` hook

**Files:**
- Create: `apps/mobile/lib/auth/useIsAppAdmin.ts`
- Test:   `apps/mobile/lib/auth/__tests__/useIsAppAdmin.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/lib/auth/__tests__/useIsAppAdmin.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react-native';
import { useIsAppAdmin } from '../useIsAppAdmin';

const isAppAdminMock = jest.fn();
jest.mock('@cultuvilla/shared/services/adminService', () => ({
  isAppAdmin: (uid: string) => isAppAdminMock(uid),
}));

const useAuthMock = jest.fn();
jest.mock('../useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

describe('useIsAppAdmin', () => {
  beforeEach(() => {
    isAppAdminMock.mockReset();
    useAuthMock.mockReset();
  });

  it('returns loading when there is no user yet', () => {
    useAuthMock.mockReturnValue({ user: null });
    const { result } = renderHook(() => useIsAppAdmin());
    expect(result.current).toEqual({ isAppAdmin: false, loading: true });
  });

  it('resolves true when the service says so', async () => {
    useAuthMock.mockReturnValue({ user: { uid: 'u1' } });
    isAppAdminMock.mockResolvedValue(true);
    const { result } = renderHook(() => useIsAppAdmin());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAppAdmin).toBe(true);
    expect(isAppAdminMock).toHaveBeenCalledWith('u1');
  });

  it('resolves false when the service says so', async () => {
    useAuthMock.mockReturnValue({ user: { uid: 'u2' } });
    isAppAdminMock.mockResolvedValue(false);
    const { result } = renderHook(() => useIsAppAdmin());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAppAdmin).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter cultuvilla-mobile test -- useIsAppAdmin`
Expected: FAIL (`Cannot find module '../useIsAppAdmin'`).

- [ ] **Step 3: Implement the hook**

Create `apps/mobile/lib/auth/useIsAppAdmin.ts`:

```ts
import { useEffect, useState } from 'react';
import { isAppAdmin as isAppAdminService } from '@cultuvilla/shared/services/adminService';
import { useAuth } from './useAuth';

export interface IsAppAdminState {
  isAppAdmin: boolean;
  loading: boolean;
}

export function useIsAppAdmin(): IsAppAdminState {
  const { user } = useAuth();
  const [state, setState] = useState<IsAppAdminState>({ isAppAdmin: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setState({ isAppAdmin: false, loading: true });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    isAppAdminService(user.uid).then((ok) => {
      if (!cancelled) setState({ isAppAdmin: ok, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return state;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter cultuvilla-mobile test -- useIsAppAdmin`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/auth/useIsAppAdmin.ts apps/mobile/lib/auth/__tests__/useIsAppAdmin.test.tsx
git commit -m "feat(mobile): add useIsAppAdmin hook"
```

---

## Task 3: App-admin route guard (`/admin/_layout.tsx`)

**Files:**
- Create: `apps/mobile/app/admin/_layout.tsx`

- [ ] **Step 1: Create the layout**

Create `apps/mobile/app/admin/_layout.tsx`:

```tsx
import { useEffect } from 'react';
import { Stack, Redirect, router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../lib/auth/useAuth';
import { useIsAppAdmin } from '../../lib/auth/useIsAppAdmin';

export default function AdminLayout() {
  const { user, loading: authLoading } = useAuth();
  const { isAppAdmin, loading: adminLoading } = useIsAppAdmin();

  useEffect(() => {
    if (authLoading || adminLoading) return;
    if (!user || !isAppAdmin) router.replace('/');
  }, [user, authLoading, isAppAdmin, adminLoading]);

  if (authLoading || adminLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (!isAppAdmin) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/admin/_layout.tsx
git commit -m "feat(mobile): add app-admin route guard"
```

---

## Task 4: App-admin hub screen

**Files:**
- Create: `apps/mobile/app/admin/index.tsx`

- [ ] **Step 1: Create the hub**

Create `apps/mobile/app/admin/index.tsx`:

```tsx
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, VStack, Text } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useT } from '../../lib/i18n';

type CardSpec = {
  href: '/admin/activate-village' | '/admin/organizer-requests' | '/admin/occupations';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
};

export default function AdminHubScreen() {
  const { t } = useT();
  const cards: CardSpec[] = [
    {
      href: '/admin/activate-village',
      icon: 'flag-outline',
      title: t('admin.hub.activateVillage'),
      hint: t('admin.hub.activateVillageHint'),
    },
    {
      href: '/admin/organizer-requests',
      icon: 'person-add-outline',
      title: t('admin.hub.organizerRequests'),
      hint: t('admin.hub.organizerRequestsHint'),
    },
    {
      href: '/admin/occupations',
      icon: 'briefcase-outline',
      title: t('admin.hub.occupations'),
      hint: t('admin.hub.occupationsHint'),
    },
  ];

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('admin.title')} />
      <VStack gap={3} className="p-4">
        {cards.map((c) => (
          <Pressable
            key={c.href}
            onPress={() => router.push(c.href)}
            className="bg-surface border border-subtle rounded-xl p-4 flex-row items-center"
          >
            <View className="w-10 h-10 rounded-xl bg-blue-100 items-center justify-center mr-3">
              <Ionicons name={c.icon} size={20} color="#1d4ed8" />
            </View>
            <View className="flex-1">
              <Text variant="h3">{c.title}</Text>
              <Text className="text-muted text-sm">{c.hint}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Pressable>
        ))}
      </VStack>
    </Screen>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/admin/index.tsx
git commit -m "feat(mobile): app-admin hub screen"
```

---

## Task 5: Profile "Administración" entry row (admin-only)

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: Add the row**

Open `apps/mobile/app/(tabs)/profile.tsx` and:

1. Add at the top:
   ```ts
   import { router } from 'expo-router';
   import { Pressable } from 'react-native';
   import { Ionicons } from '@expo/vector-icons';
   import { useIsAppAdmin } from '../../lib/auth/useIsAppAdmin';
   ```
2. Inside `ProfileScreen`, before the `return`, add:
   ```ts
   const { isAppAdmin } = useIsAppAdmin();
   ```
3. Below the `<HStack>` with the Change Photo / Sign Out buttons, add this conditional row inside the `<VStack>`:
   ```tsx
   {isAppAdmin ? (
     <Pressable
       onPress={() => router.push('/admin')}
       className="bg-surface border border-subtle rounded-xl p-4 mt-4 flex-row items-center"
       accessibilityRole="button"
       accessibilityLabel={t('admin.profileEntry')}
     >
       <Ionicons name="shield-checkmark-outline" size={20} color="#0f172a" />
       <Text className="ml-3 flex-1">{t('admin.profileEntry')}</Text>
       <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
     </Pressable>
   ) : null}
   ```

- [ ] **Step 2: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(tabs)/profile.tsx
git commit -m "feat(mobile): admin entry row in Profile tab"
```

---

## Task 6: Activate-village screen

**Files:**
- Create: `apps/mobile/app/admin/activate-village.tsx`

- [ ] **Step 1: Create the screen**

Create `apps/mobile/app/admin/activate-village.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, VStack, HStack, Text, Button, Input, Pressable } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useT } from '../../lib/i18n';
import { useAuth } from '../../lib/auth/useAuth';
import {
  getMunicipalities,
  activateCommunity,
} from '@cultuvilla/shared/services/municipalityService';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality';

type Row = MunicipalityData & { id: string };

export default function ActivateVillageScreen() {
  const { t } = useT();
  const { user } = useAuth();
  const [muns, setMuns] = useState<Row[] | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMunicipalities().then(setMuns);
  }, []);

  const filtered = useMemo(() => {
    if (!muns) return [];
    const q = query.trim().toLowerCase();
    const base = muns.filter((m) => !m.communityActive);
    if (!q) return base.slice(0, 50);
    return base
      .filter((m) =>
        [m.name, m.province, m.codigoINE].some((s) => s.toLowerCase().includes(q)),
      )
      .slice(0, 50);
  }, [muns, query]);

  async function onSubmit() {
    if (!selected || !user) return;
    setSaving(true);
    try {
      await activateCommunity(selected.id, {
        description,
        coverImages: [],
        adminUserId: user.uid,
      });
      Alert.alert(t('admin.activate.success'));
      router.replace('/admin');
    } catch (e) {
      Alert.alert(e instanceof Error ? e.message : 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('admin.activate.title')} />
      <VStack gap={3} className="p-4 flex-1">
        {!selected ? (
          <>
            <Text variant="h3">{t('admin.activate.pickMunicipality')}</Text>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder={t('admin.activate.searchPlaceholder')}
            />
            <FlatList
              data={filtered}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setSelected(item)}
                  className="py-3 border-b border-subtle"
                >
                  <Text>{item.name}</Text>
                  <Text className="text-muted text-xs">
                    {item.province} · {item.codigoINE}
                  </Text>
                </Pressable>
              )}
            />
          </>
        ) : (
          <>
            <View className="bg-surface border border-subtle rounded-xl p-3">
              <Text variant="h3">{selected.name}</Text>
              <Text className="text-muted text-sm">
                {selected.province} · {selected.codigoINE}
              </Text>
            </View>
            <Text>{t('admin.activate.description')}</Text>
            <Input value={description} onChangeText={setDescription} multiline />
            <HStack gap={2}>
              <Button variant="ghost" onPress={() => setSelected(null)}>
                {t('common.back')}
              </Button>
              <Button onPress={onSubmit} loading={saving} disabled={!description.trim()}>
                {t('admin.activate.submit')}
              </Button>
            </HStack>
          </>
        )}
      </VStack>
    </Screen>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/admin/activate-village.tsx
git commit -m "feat(mobile): activate-village admin screen"
```

---

## Task 7: Organizer-requests screen

**Files:**
- Create: `apps/mobile/app/admin/organizer-requests.tsx`

- [ ] **Step 1: Create the screen**

Create `apps/mobile/app/admin/organizer-requests.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { FlatList, View, ActivityIndicator } from 'react-native';
import { Screen, VStack, HStack, Text, Button } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useT } from '../../lib/i18n';
import { useAuth } from '../../lib/auth/useAuth';
import {
  getPendingOrganizerRequests,
  respondToOrganizerRequest,
} from '@cultuvilla/shared/services/organizerRequestService';
import type { OrganizerRequestData } from '@cultuvilla/shared/models/municipality/OrganizerRequestDataModel';

type Row = OrganizerRequestData & { id: string };

export default function OrganizerRequestsScreen() {
  const { t } = useT();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(await getPendingOrganizerRequests());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(req: Row, decision: 'approved' | 'rejected') {
    if (!user) return;
    setBusyId(req.id);
    try {
      await respondToOrganizerRequest({
        municipalityId: req.municipalityId,
        userId: req.userId,
        decision,
        reviewedBy: user.uid,
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('admin.organizerRequests.title')} />
      {rows === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : rows.length === 0 ? (
        <View className="p-4">
          <Text>{t('admin.organizerRequests.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <VStack gap={2} className="bg-surface border border-subtle rounded-xl p-3">
              <Text variant="h3">{item.userId}</Text>
              <Text className="text-muted text-sm">{item.municipalityId}</Text>
              <HStack gap={2}>
                <Button
                  onPress={() => decide(item, 'approved')}
                  loading={busyId === item.id}
                >
                  {t('admin.organizerRequests.approve')}
                </Button>
                <Button
                  variant="ghost"
                  onPress={() => decide(item, 'rejected')}
                  loading={busyId === item.id}
                >
                  {t('admin.organizerRequests.reject')}
                </Button>
              </HStack>
            </VStack>
          )}
        />
      )}
    </Screen>
  );
}
```

**Note:** verify the exact `respondToOrganizerRequest` payload shape — if signatures differ, update field names to match the source. Run `pnpm app:typecheck` to confirm.

- [ ] **Step 2: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS (fix payload shape if it errors).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/admin/organizer-requests.tsx
git commit -m "feat(mobile): organizer-requests admin screen"
```

---

## Task 8: Occupations screen

**Files:**
- Create: `apps/mobile/app/admin/occupations.tsx`

- [ ] **Step 1: Create the screen**

Create `apps/mobile/app/admin/occupations.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { FlatList, View, ActivityIndicator, Alert } from 'react-native';
import { Screen, VStack, HStack, Text, Button, Input, Pressable } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useT } from '../../lib/i18n';
import { useAuth } from '../../lib/auth/useAuth';
import {
  getOccupations,
  createOccupation,
  deleteOccupation,
  getPendingProposals,
  reviewProposal,
} from '@cultuvilla/shared/services/occupationService';
import type { OccupationData, OccupationProposalData } from '@cultuvilla/shared/models/occupation';

type Occ = OccupationData & { id: string };
type Prop = OccupationProposalData & { id: string };

export default function OccupationsScreen() {
  const { t } = useT();
  const { user } = useAuth();
  const [occs, setOccs] = useState<Occ[] | null>(null);
  const [props, setProps] = useState<Prop[] | null>(null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [o, p] = await Promise.all([getOccupations(), getPendingProposals()]);
    setOccs(o);
    setProps(p);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await createOccupation({ name: newName.trim() });
      setNewName('');
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function remove(o: Occ) {
    Alert.alert(t('common.delete'), o.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(o.id);
          try { await deleteOccupation(o.id); await load(); } finally { setBusyId(null); }
        },
      },
    ]);
  }

  async function review(p: Prop, decision: 'approved' | 'rejected') {
    if (!user) return;
    setBusyId(p.id);
    try {
      await reviewProposal({ proposalId: p.id, decision, reviewedBy: user.uid });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('admin.occupations.title')} />
      <VStack gap={3} className="p-4">
        <Text variant="h3">{t('admin.occupations.proposals')}</Text>
        {props === null ? (
          <ActivityIndicator />
        ) : props.length === 0 ? (
          <Text className="text-muted">{t('admin.occupations.noProposals')}</Text>
        ) : (
          props.map((p) => (
            <VStack key={p.id} gap={2} className="bg-surface border border-subtle rounded-xl p-3">
              <Text variant="h3">{p.name}</Text>
              <HStack gap={2}>
                <Button onPress={() => review(p, 'approved')} loading={busyId === p.id}>
                  {t('admin.occupations.approve')}
                </Button>
                <Button variant="ghost" onPress={() => review(p, 'rejected')} loading={busyId === p.id}>
                  {t('admin.occupations.reject')}
                </Button>
              </HStack>
            </VStack>
          ))
        )}

        <Text variant="h3" className="mt-4">{t('admin.occupations.catalog')}</Text>
        <HStack gap={2}>
          <View className="flex-1">
            <Input
              value={newName}
              onChangeText={setNewName}
              placeholder={t('admin.occupations.addName')}
            />
          </View>
          <Button onPress={add} loading={adding} disabled={!newName.trim()}>
            {t('admin.occupations.add')}
          </Button>
        </HStack>
        <FlatList
          data={occs ?? []}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => (
            <Pressable onLongPress={() => remove(item)} className="py-3 border-b border-subtle">
              <Text>{item.name}</Text>
            </Pressable>
          )}
          ListEmptyComponent={occs ? null : <ActivityIndicator />}
        />
      </VStack>
    </Screen>
  );
}
```

**Note:** check the exact signatures of `createOccupation` and `reviewProposal` (the field names `proposalId` / `reviewedBy` may differ). Typecheck will surface mismatches.

- [ ] **Step 2: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS (adjust payloads if needed to match the source).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/admin/occupations.tsx
git commit -m "feat(mobile): occupations admin screen"
```

---

## Task 9: Village-admin route guard

**Files:**
- Create: `apps/mobile/app/village/[villageId]/admin/_layout.tsx`

- [ ] **Step 1: Create the layout**

Create `apps/mobile/app/village/[villageId]/admin/_layout.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Stack, Redirect, useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../../../lib/auth/useAuth';
import { useIsAppAdmin } from '../../../../lib/auth/useIsAppAdmin';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';

export default function VillageAdminLayout() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { isAppAdmin, loading: appAdminLoading } = useIsAppAdmin();
  const [villageAdmin, setVillageAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || !villageId) {
      setVillageAdmin(null);
      return;
    }
    let cancelled = false;
    isVillageAdmin(villageId, user.uid).then((ok) => {
      if (!cancelled) setVillageAdmin(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [user, villageId]);

  const loading = authLoading || appAdminLoading || villageAdmin === null;
  const canManage = isAppAdmin || villageAdmin === true;

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (!canManage) router.replace(`/village/${villageId}`);
  }, [loading, user, canManage, villageId]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (!canManage) return <Redirect href={`/village/${villageId}`} />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/village/\[villageId\]/admin/_layout.tsx
git commit -m "feat(mobile): village-admin route guard"
```

---

## Task 10: Village-admin hub

**Files:**
- Create: `apps/mobile/app/village/[villageId]/admin/index.tsx`

- [ ] **Step 1: Create the hub**

Create `apps/mobile/app/village/[villageId]/admin/index.tsx`:

```tsx
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, VStack, Text, Pressable } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';

export default function VillageAdminHub() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const base = `/village/${villageId}/admin` as const;

  const items: Array<{ href: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
    { href: `${base}/community`, icon: 'home-outline', label: t('village.admin.hub.community') },
    { href: `${base}/barrios`, icon: 'map-outline', label: t('village.admin.hub.barrios') },
    { href: `${base}/cemeteries`, icon: 'leaf-outline', label: t('village.admin.hub.cemeteries') },
    { href: `${base}/organizations`, icon: 'business-outline', label: t('village.admin.hub.organizations') },
    { href: `${base}/invite-tokens`, icon: 'link-outline', label: t('village.admin.hub.invites') },
    { href: `${base}/censo`, icon: 'list-outline', label: t('village.admin.hub.censo') },
    { href: `${base}/requests`, icon: 'people-outline', label: t('village.admin.hub.joinRequests') },
  ];

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.title')} />
      <VStack gap={3} className="p-4">
        {items.map((it) => (
          <Pressable
            key={it.href}
            onPress={() => router.push(it.href as never)}
            className="bg-surface border border-subtle rounded-xl p-4 flex-row items-center"
          >
            <View className="w-10 h-10 rounded-xl bg-blue-100 items-center justify-center mr-3">
              <Ionicons name={it.icon} size={20} color="#1d4ed8" />
            </View>
            <Text className="flex-1">{it.label}</Text>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Pressable>
        ))}
      </VStack>
    </Screen>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/village/\[villageId\]/admin/index.tsx
git commit -m "feat(mobile): village-admin hub screen"
```

---

## Task 11: Gear icon on village screen + entry-point gating

**Files:**
- Modify: `apps/mobile/app/village/[villageId]/index.tsx`
- Modify: `apps/mobile/components/layout/AppHeader.tsx` (add a right-slot prop)

- [ ] **Step 1: Extend AppHeader with a `rightSlot`**

In `apps/mobile/components/layout/AppHeader.tsx`:

1. Update the type:
   ```ts
   import type { ReactNode } from 'react';
   export type AppHeaderProps = {
     centerLabel?: string;
     extraRightSlot?: ReactNode;
   };
   ```
2. Accept and render it. Inside the right-side `<View className="flex-row items-center gap-2">`, add `{extraRightSlot}` BEFORE the notifications Pressable:
   ```tsx
   <View className="flex-row items-center gap-2">
     {extraRightSlot}
     <Pressable ...notifications... />
     <Pressable ...menu... />
   </View>
   ```

- [ ] **Step 2: Wire gear icon in the village screen**

In `apps/mobile/app/village/[villageId]/index.tsx`:

1. Add imports at the top:
   ```ts
   import { Pressable } from 'react-native';
   import { Ionicons } from '@expo/vector-icons';
   import { useIsAppAdmin } from '../../../lib/auth/useIsAppAdmin';
   import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';
   import { useAuth } from '../../../lib/auth/useAuth';
   ```
2. Inside `VillageHome`, add:
   ```ts
   const { user } = useAuth();
   const { isAppAdmin } = useIsAppAdmin();
   const [villageAdmin, setVillageAdmin] = useState(false);
   useEffect(() => {
     if (!user || !villageId) return;
     isVillageAdmin(villageId as string, user.uid).then(setVillageAdmin);
   }, [user, villageId]);
   const canManage = isAppAdmin || villageAdmin;
   ```
3. Find the `<AppHeader centerLabel={village?.name} />` and replace with:
   ```tsx
   <AppHeader
     centerLabel={village?.name}
     extraRightSlot={
       canManage ? (
         <Pressable
           onPress={() => router.push(`/village/${villageId}/admin` as never)}
           accessibilityLabel={t('village.admin.open')}
           className="p-1"
         >
           <Ionicons name="settings-outline" size={22} color="#0f172a" />
         </Pressable>
       ) : null
     }
   />
   ```
4. Make sure `router` is already imported (it is, at the top of that file).

- [ ] **Step 3: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/layout/AppHeader.tsx apps/mobile/app/village/\[villageId\]/index.tsx
git commit -m "feat(mobile): village header gear icon for admins"
```

---

## Task 12: Barrios screen

**Files:**
- Create: `apps/mobile/app/village/[villageId]/admin/barrios.tsx`

- [ ] **Step 1: Create the screen**

Create `apps/mobile/app/village/[villageId]/admin/barrios.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { FlatList, View, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, VStack, HStack, Text, Button, Input, Pressable } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import {
  getBarrios,
  createBarrio,
  updateBarrio,
  deleteBarrio,
} from '@cultuvilla/shared/services/municipalityService';
import type { BarrioData } from '@cultuvilla/shared/models/municipality';

type Row = BarrioData & { id: string };

export default function BarriosScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    if (!villageId) return;
    setRows(await getBarrios(villageId));
  }, [villageId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!villageId || !name.trim()) return;
    setSaving(true);
    try {
      await createBarrio(villageId, { name: name.trim(), municipalityId: villageId });
      setName('');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!villageId || !editingId || !editName.trim()) return;
    setSaving(true);
    try {
      await updateBarrio(villageId, editingId, { name: editName.trim() });
      setEditingId(null);
      setEditName('');
      await load();
    } finally {
      setSaving(false);
    }
  }

  function remove(r: Row) {
    Alert.alert(t('common.delete'), r.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!villageId) return;
          await deleteBarrio(villageId, r.id);
          await load();
        },
      },
    ]);
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.barrios.title')} />
      <VStack gap={3} className="p-4">
        <HStack gap={2}>
          <View className="flex-1">
            <Input
              value={name}
              onChangeText={setName}
              placeholder={t('village.admin.barrios.name')}
            />
          </View>
          <Button onPress={add} loading={saving} disabled={!name.trim()}>
            {t('village.admin.barrios.add')}
          </Button>
        </HStack>
        <FlatList
          data={rows ?? []}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <View className="py-3 border-b border-subtle">
              {editingId === item.id ? (
                <HStack gap={2}>
                  <View className="flex-1">
                    <Input value={editName} onChangeText={setEditName} />
                  </View>
                  <Button onPress={saveEdit} loading={saving}>
                    {t('common.save')}
                  </Button>
                  <Button variant="ghost" onPress={() => setEditingId(null)}>
                    {t('common.cancel')}
                  </Button>
                </HStack>
              ) : (
                <HStack gap={2}>
                  <Text className="flex-1">{item.name}</Text>
                  <Pressable onPress={() => { setEditingId(item.id); setEditName(item.name); }}>
                    <Text className="text-blue-600">{t('common.edit')}</Text>
                  </Pressable>
                  <Pressable onPress={() => remove(item)}>
                    <Text className="text-red-600">{t('common.delete')}</Text>
                  </Pressable>
                </HStack>
              )}
            </View>
          )}
          ListEmptyComponent={
            rows && rows.length === 0 ? (
              <Text className="text-muted">{t('village.admin.barrios.empty')}</Text>
            ) : null
          }
        />
      </VStack>
    </Screen>
  );
}
```

**Note:** confirm `createBarrio`'s exact input signature — if `BarrioDataInput` doesn't have `municipalityId`, drop it from the call. Typecheck will tell you.

- [ ] **Step 2: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/village/\[villageId\]/admin/barrios.tsx
git commit -m "feat(mobile): barrios admin screen"
```

---

## Task 13: Cementerios screen

**Files:**
- Create: `apps/mobile/app/village/[villageId]/admin/cemeteries.tsx`

- [ ] **Step 1: Create the screen**

Create `apps/mobile/app/village/[villageId]/admin/cemeteries.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { FlatList, View, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, VStack, HStack, Text, Button, Input, Pressable } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import {
  getCemeteries,
  createCemetery,
  updateCemetery,
  deleteCemetery,
} from '@cultuvilla/shared/services/municipalityService';
import type { CemeteryData } from '@cultuvilla/shared/models/municipality';

type Row = CemeteryData & { id: string };

export default function CemeteriesScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const load = useCallback(async () => {
    if (!villageId) return;
    setRows(await getCemeteries(villageId));
  }, [villageId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!villageId || !name.trim()) return;
    setSaving(true);
    try {
      await createCemetery(villageId, {
        name: name.trim(),
        description: description.trim(),
        municipalityId: villageId,
      });
      setName('');
      setDescription('');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!villageId || !editingId) return;
    setSaving(true);
    try {
      await updateCemetery(villageId, editingId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  function remove(r: Row) {
    Alert.alert(t('common.delete'), r.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!villageId) return;
          await deleteCemetery(villageId, r.id);
          await load();
        },
      },
    ]);
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.cemeteries.title')} />
      <VStack gap={3} className="p-4">
        <VStack gap={2}>
          <Input value={name} onChangeText={setName} placeholder={t('village.admin.cemeteries.name')} />
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder={t('village.admin.cemeteries.description')}
            multiline
          />
          <Button onPress={add} loading={saving} disabled={!name.trim()}>
            {t('village.admin.cemeteries.add')}
          </Button>
        </VStack>
        <FlatList
          data={rows ?? []}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <View className="py-3 border-b border-subtle">
              {editingId === item.id ? (
                <VStack gap={2}>
                  <Input value={editName} onChangeText={setEditName} />
                  <Input value={editDescription} onChangeText={setEditDescription} multiline />
                  <HStack gap={2}>
                    <Button onPress={saveEdit} loading={saving}>{t('common.save')}</Button>
                    <Button variant="ghost" onPress={() => setEditingId(null)}>{t('common.cancel')}</Button>
                  </HStack>
                </VStack>
              ) : (
                <HStack gap={2}>
                  <View className="flex-1">
                    <Text>{item.name}</Text>
                    {item.description ? (
                      <Text className="text-muted text-sm">{item.description}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => {
                      setEditingId(item.id);
                      setEditName(item.name);
                      setEditDescription(item.description ?? '');
                    }}
                  >
                    <Text className="text-blue-600">{t('common.edit')}</Text>
                  </Pressable>
                  <Pressable onPress={() => remove(item)}>
                    <Text className="text-red-600">{t('common.delete')}</Text>
                  </Pressable>
                </HStack>
              )}
            </View>
          )}
          ListEmptyComponent={
            rows && rows.length === 0 ? (
              <Text className="text-muted">{t('village.admin.cemeteries.empty')}</Text>
            ) : null
          }
        />
      </VStack>
    </Screen>
  );
}
```

**Note:** confirm `CemeteryDataInput` fields and drop any extras the type doesn't accept.

- [ ] **Step 2: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/village/\[villageId\]/admin/cemeteries.tsx
git commit -m "feat(mobile): cemeteries admin screen"
```

---

## Task 14: Organizations screen

**Files:**
- Create: `apps/mobile/app/village/[villageId]/admin/organizations.tsx`

- [ ] **Step 1: Create the screen**

Create `apps/mobile/app/village/[villageId]/admin/organizations.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { FlatList, View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, VStack, HStack, Text, Button } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import { useAuth } from '../../../../lib/auth/useAuth';
import {
  getOrganizationsByMunicipality,
  approveOrganization,
  rejectOrganization,
} from '@cultuvilla/shared/services/organizationService';
import type { OrganizationData } from '@cultuvilla/shared/models/organization';

type Row = OrganizationData & { id: string };

export default function OrganizationsScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!villageId) return;
    setRows(await getOrganizationsByMunicipality(villageId));
  }, [villageId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(r: Row) {
    if (!user) return;
    setBusyId(r.id);
    try { await approveOrganization(r.id, user.uid); await load(); } finally { setBusyId(null); }
  }
  async function reject(r: Row) {
    setBusyId(r.id);
    try { await rejectOrganization(r.id); await load(); } finally { setBusyId(null); }
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.organizations.title')} />
      {rows === null ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      ) : rows.length === 0 ? (
        <View className="p-4"><Text>{t('village.admin.organizations.empty')}</Text></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <VStack gap={2} className="bg-surface border border-subtle rounded-xl p-3">
              <Text variant="h3">{item.name}</Text>
              <Text className="text-muted text-sm">{item.status}</Text>
              {item.status === 'pending' ? (
                <HStack gap={2}>
                  <Button onPress={() => approve(item)} loading={busyId === item.id}>
                    {t('village.admin.organizations.approve')}
                  </Button>
                  <Button variant="ghost" onPress={() => reject(item)} loading={busyId === item.id}>
                    {t('village.admin.organizations.reject')}
                  </Button>
                </HStack>
              ) : null}
            </VStack>
          )}
        />
      )}
    </Screen>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/village/\[villageId\]/admin/organizations.tsx
git commit -m "feat(mobile): organizations admin screen"
```

---

## Task 15: Invite-tokens screen

**Files:**
- Create: `apps/mobile/app/village/[villageId]/admin/invite-tokens.tsx`

- [ ] **Step 1: Create the screen**

Create `apps/mobile/app/village/[villageId]/admin/invite-tokens.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { FlatList, View, Alert, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { Screen, VStack, HStack, Text, Button, Pressable } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import { useAuth } from '../../../../lib/auth/useAuth';
import {
  createInviteToken,
  getInviteTokens,
  deleteInviteToken,
} from '@cultuvilla/shared/services/inviteTokenService';
import type { InviteTokenData } from '@cultuvilla/shared/models/municipality';

type Row = InviteTokenData & { id: string };

export default function InviteTokensScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!villageId) return;
    setRows(await getInviteTokens(villageId));
  }, [villageId]);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    if (!villageId || !user) return;
    setBusy(true);
    try { await createInviteToken(villageId, user.uid); await load(); } finally { setBusy(false); }
  }

  async function copy(r: Row) {
    const url = `https://cultuvilla.app/invite/${r.id}`;
    await Clipboard.setStringAsync(url);
    if (Platform.OS !== 'web') Alert.alert(t('village.admin.invites.copied'));
  }

  function remove(r: Row) {
    Alert.alert(t('common.delete'), r.id, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!villageId) return;
          await deleteInviteToken(villageId, r.id);
          await load();
        },
      },
    ]);
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.invites.title')} />
      <VStack gap={3} className="p-4">
        <Button onPress={create} loading={busy}>
          {t('village.admin.invites.create')}
        </Button>
        <FlatList
          data={rows ?? []}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <View className="py-3 border-b border-subtle">
              <HStack gap={2}>
                <Text className="flex-1 font-mono text-xs">{item.id}</Text>
                <Pressable onPress={() => copy(item)}>
                  <Text className="text-blue-600">{t('village.admin.invites.copy')}</Text>
                </Pressable>
                <Pressable onPress={() => remove(item)}>
                  <Text className="text-red-600">{t('village.admin.invites.delete')}</Text>
                </Pressable>
              </HStack>
            </View>
          )}
          ListEmptyComponent={
            rows && rows.length === 0 ? (
              <Text className="text-muted">{t('village.admin.invites.empty')}</Text>
            ) : null
          }
        />
      </VStack>
    </Screen>
  );
}
```

**Note:** `createInviteToken` signature may differ — check the source and adjust the call. The invite URL format must match what the existing `/invite/[token]` route expects in the app.

- [ ] **Step 2: Confirm `expo-clipboard` is installed**

Run: `grep '"expo-clipboard"' apps/mobile/package.json`
If absent: `pnpm --filter cultuvilla-mobile add expo-clipboard` and commit the lockfile change as part of the same task.

- [ ] **Step 3: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/village/\[villageId\]/admin/invite-tokens.tsx apps/mobile/package.json pnpm-lock.yaml 2>/dev/null
git commit -m "feat(mobile): invite-tokens admin screen"
```

---

## Task 16: Censo schema screen

**Files:**
- Create: `apps/mobile/app/village/[villageId]/admin/censo.tsx`

This screen reuses logic from the web `/village/[id]/admin/censo` page: it loads the current `community.profileForm.fields`, detects which keys are "locked" (used by existing members), and lets the admin add / remove / reorder fields, then save the schema via `updateCensoSchema`.

- [ ] **Step 1: Create the screen**

Create `apps/mobile/app/village/[villageId]/admin/censo.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, VStack, HStack, Text, Button, Input, Pressable } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { updateCensoSchema } from '@cultuvilla/shared/services/censoService';
import {
  collectUsedValues,
  type MembershipProfile,
} from '@cultuvilla/shared/services/membershipProfileService';
import { getVillageMembers } from '@cultuvilla/shared/services/villageMemberService';
import type { ProfileFormField } from '@cultuvilla/shared/models/municipality/CensoTypes';

export default function CensoSchemaScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const [fields, setFields] = useState<ProfileFormField[] | null>(null);
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const load = useCallback(async () => {
    if (!villageId) return;
    const [mun, members] = await Promise.all([
      getMunicipality(villageId),
      getVillageMembers(villageId),
    ]);
    const used = collectUsedValues(members as unknown as MembershipProfile[]);
    setLocked(new Set(Object.entries(used).filter(([, v]) => v.size > 0).map(([k]) => k)));
    setFields(mun?.community?.profileForm?.fields ?? []);
  }, [villageId]);

  useEffect(() => { void load(); }, [load]);

  function addField() {
    if (!fields) return;
    const key = newKey.trim();
    if (!key || fields.some((f) => f.key === key)) return;
    setFields([...fields, { key, label: newLabel.trim() || key, type: 'text', required: false }]);
    setNewKey('');
    setNewLabel('');
  }

  function removeField(key: string) {
    if (!fields) return;
    if (locked.has(key)) {
      Alert.alert('Locked', `${key} is in use and cannot be removed.`);
      return;
    }
    setFields(fields.filter((f) => f.key !== key));
  }

  async function save() {
    if (!villageId || !fields) return;
    setSaving(true);
    try {
      await updateCensoSchema(villageId, { fields });
      Alert.alert(t('village.admin.community.saved'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.hub.censo')} />
      <VStack gap={3} className="p-4">
        {fields === null ? (
          <Text>{t('common.loading')}</Text>
        ) : (
          <>
            {fields.map((f) => (
              <HStack key={f.key} gap={2} className="bg-surface border border-subtle rounded-xl p-3">
                <View className="flex-1">
                  <Text>{f.label}</Text>
                  <Text className="text-muted text-xs">{f.key} · {f.type}</Text>
                </View>
                {locked.has(f.key) ? (
                  <Text className="text-xs text-orange-600">locked</Text>
                ) : (
                  <Pressable onPress={() => removeField(f.key)}>
                    <Text className="text-red-600">{t('common.delete')}</Text>
                  </Pressable>
                )}
              </HStack>
            ))}
            <VStack gap={2}>
              <Input value={newKey} onChangeText={setNewKey} placeholder="key" />
              <Input value={newLabel} onChangeText={setNewLabel} placeholder="label" />
              <Button variant="ghost" onPress={addField} disabled={!newKey.trim()}>
                {t('common.create')}
              </Button>
            </VStack>
            <Button onPress={save} loading={saving}>{t('common.save')}</Button>
          </>
        )}
      </VStack>
    </Screen>
  );
}
```

**Note:** confirm the exact signature of `updateCensoSchema` and the `MembershipProfile` shape — if the typecheck flags differences, adjust the call shape and the cast.

- [ ] **Step 2: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/village/\[villageId\]/admin/censo.tsx
git commit -m "feat(mobile): censo schema admin screen"
```

---

## Task 17: Community settings screen

**Files:**
- Create: `apps/mobile/app/village/[villageId]/admin/community.tsx`

- [ ] **Step 1: Create the screen**

Create `apps/mobile/app/village/[villageId]/admin/community.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, VStack, Text, Button, Input } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import {
  getMunicipality,
  updateCommunity,
} from '@cultuvilla/shared/services/municipalityService';

export default function CommunitySettingsScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const [description, setDescription] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!villageId) return;
    getMunicipality(villageId).then((m) => {
      setDescription(m?.community?.description ?? '');
    });
  }, [villageId]);

  async function save() {
    if (!villageId || description === null) return;
    setSaving(true);
    try {
      await updateCommunity(villageId, { description });
      Alert.alert(t('village.admin.community.saved'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.community.title')} />
      <VStack gap={3} className="p-4">
        <Text variant="h3">{t('village.admin.community.description')}</Text>
        <Input
          value={description ?? ''}
          onChangeText={setDescription}
          multiline
          placeholder={t('village.admin.community.description')}
        />
        <Button onPress={save} loading={saving}>{t('common.save')}</Button>
      </VStack>
    </Screen>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/village/\[villageId\]/admin/community.tsx
git commit -m "feat(mobile): community settings admin screen"
```

---

## Task 18: Final verification

- [ ] **Step 1: Typecheck the whole monorepo**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 2: Run the mobile + shared test suites**

Run: `pnpm shared:test && pnpm --filter cultuvilla-mobile test`
Expected: PASS (apart from the 2 pre-existing `UserDataModel` failures on `main`, which are unrelated to this work — note them in the report but do not block).

- [ ] **Step 3: Manual smoke (optional but recommended)**

Run `pnpm --filter cultuvilla-mobile start --web` and click through, as three personas:
- Non-admin: Profile shows no "Administración" row; village screen shows no gear icon; deep-linking `/admin` redirects to `/`.
- Village admin only: gear icon shows on own village, not on others; `/admin` deep-link still redirects.
- App admin: Profile row shows; gear icon shows on every village; `/admin` opens hub.

- [ ] **Step 4: Final report**

Report what was implemented, pre-existing failures observed, and any service-signature adjustments made versus the plan.
