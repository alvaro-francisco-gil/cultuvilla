# Discover-screen join flow + conditional "Cambiar de pueblo"

**Goal:** Let users join an active village directly from the Buscar pueblo (discover) list via a per-card action, and hide "Cambiar de pueblo" for users who belong to only one village.

## Context

Today "Unirse a otro pueblo" (profile) and "Cambiar de pueblo" / "Buscar pueblo" (user menu) all funnel to either `/me/villages` (the switcher) or `/discover`. Two problems:

1. **"Cambiar de pueblo" is shown unconditionally**, even for users in a single village, where there is nothing to switch between.
2. **Joining a village requires drilling into its home page.** The discover card only navigates; the join confirm lives on `/village/[villageId]`. The card also carries an "Activo" text label that adds little.

This plan adds an inline join affordance to the discover card and makes the switcher menu item conditional.

## Design / approach

### 1. "Cambiar de pueblo" conditional on >1 village

In `apps/mobile/components/feature/UserMenuModal.tsx`:

- The modal already fetches the person on `visible`. Alongside it, fetch `getUserMemberships(user.uid)` and store `villageCount` in state (reset when not visible).
- Build the `swap-horizontal-outline` "Cambiar de pueblo" (`menu.switchVillage`) item only when `villageCount > 1`.
- "Buscar pueblo" (`menu.findVillage`) stays always-visible — single-village users reach other villages through it.

No change to `/me/villages` itself.

### 2. Discover card redesign

In `apps/mobile/components/feature/VillageDiscovery.tsx`:

- On mount (when a user is logged in), fetch the user's memberships into a `Set<string>` of `municipalityId` (`joinedIds`). Reuse `getUserMemberships`. Tolerate logged-out / fetch failure by treating the set as empty.
- **Active village card** (`m.communityActive`):
  - Remove the "Activo" / accent text label on the right.
  - Card body remains pressable → `router.push('/village/[villageId]')` for that village (unchanged target).
  - Add an **eye icon** button (`eye-outline`) → same navigation as the card body (view that village's home).
  - Add a **person-plus** button (`person-add-outline`) on the right → opens the join-confirm modal for that village.
  - If `joinedIds.has(m.id)`, replace the person-plus with a muted **checkmark** icon (`checkmark-circle`, non-interactive) — the user is already a member.
- **Inactive municipio card** (`!m.communityActive`): unchanged. No eye/join buttons; whole card routes to `/discover/start/[municipalityId]`. Keep the existing "Sin comunidad" (`discover.inactive`) muted label — it is that card's only affordance hint.

The accent border on active cards (`border-accent`) stays.

### 3. Join-confirm modal

A small confirmation modal rendered by `VillageDiscovery` (single instance, driven by `pendingJoin: Muni | null` state):

- Use React Native `Modal` (`transparent`, centered dialog) — **not** `Alert.alert`, which is a no-op on RN-Web 0.21 and per the user's request for a modal.
- Content: village name + body copy, a cancel button and a confirm button.
- Reuse existing i18n: `village.joinConfirm.title`, `village.joinConfirm.body`, `village.joinConfirm.confirm`, `village.joinConfirm.cancel`.
- On confirm: call `addVillageMember(m.id, user.uid)`; on success, close the modal, add `m.id` to `joinedIds`, and `router.push('/village/[villageId]')` for the joined village. Show a busy state on the confirm button while in flight.
- If not logged in when person-plus is pressed: route to `/(auth)/login` (mirror `VillageHomeBody.onJoin`).

### New i18n keys (packages/i18n)

Add under the `discover` namespace (es + any other locale files):

- `discover.viewVillage` — accessibility label for the eye button (e.g. "Ver pueblo").
- `discover.joinVillage` — accessibility label for the person-plus button (e.g. "Unirse a este pueblo").
- `discover.alreadyMember` — accessibility label for the member checkmark (e.g. "Ya eres miembro").

Reuse `village.joinConfirm.*` for the modal text. Follow the `i18n-add-string` skill when adding.

### Web compatibility

- New buttons are plain `Pressable` (no `Animated.View` + `className` pitfall).
- The join confirm uses `Modal` + a confirm `Pressable`, avoiding `Alert.alert` (no-op on web). Follow `mobile-web-compat`.

## Out of scope

- Changing `/me/villages` or the profile `VillagesScroll` "Unirse a otro pueblo" target (still `/discover`).
- "Request to join" / approval workflow — join is immediate self-join via `addVillageMember`, matching the existing village-home behavior.
- Setting the joined village as the active municipality (the existing `AuthContext` auto-sync already promotes a first/only membership to active; multi-village users keep their current active village).

---

## For agentic workers

Implement task-by-task. There is **no component-test harness in `apps/mobile/`** (vitest only covers `packages/shared` and `functions/`), so these UI tasks are not RED/GREEN TDD. Each task's verification is `pnpm check` (typecheck + lint + shared tests) plus the manual check noted in the task. Commit after each task. Steps use `- [ ]` for tracking.

## File Structure

- **Modify** `packages/i18n/messages/es.json` — add 3 keys under `discover`, remove the now-unused `discover.activeBadge`.
- **Modify** `apps/mobile/components/feature/VillageDiscovery.tsx` — fetch memberships, redesign the active-village card (eye + join buttons, drop the Activo label), add the join-confirm modal.
- **Modify** `apps/mobile/components/feature/UserMenuModal.tsx` — fetch membership count, gate the "Cambiar de pueblo" item on `villageCount > 1`.

No new files; no shared-service changes (`addVillageMember` and `getUserMemberships` already exist in `packages/shared/src/services/villageMemberService.ts`).

## Tasks

### Task 1: i18n keys

**Files:**
- Modify: `packages/i18n/messages/es.json` (the `discover` block at ~line 525)

- [ ] **Step 1: Edit the `discover` block** — replace the trailing `activeBadge` key with the three new a11y keys:

```jsonc
  "discover": {
    "title": "Buscar pueblo",
    "search": "Busca tu pueblo",
    "empty": "No se encontraron pueblos",
    "inactive": "Sin comunidad",
    "activeGroup": "Municipios activos",
    "allGroup": "Todos",
    "viewVillage": "Ver pueblo",
    "joinVillage": "Unirse a este pueblo",
    "alreadyMember": "Ya eres miembro"
  },
```

(`activeBadge` is removed — its only consumer is the card line deleted in Task 2.)

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "require('./packages/i18n/messages/es.json')" && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "i18n(discover): add view/join/member a11y labels, drop activeBadge"
```

### Task 2: Discover card redesign + join modal

**Files:**
- Modify: `apps/mobile/components/feature/VillageDiscovery.tsx`

**Interfaces (already exist — consume, don't define):**
- `getUserMemberships(userId: string): Promise<UserMembership[]>` and `addVillageMember(municipalityId: string, userId: string): Promise<void>` from `@cultuvilla/shared/services/villageMemberService`.
- `useAuth()` from `../../lib/auth/useAuth` exposes `{ user }` where `user.uid` is the Firebase uid (see `UserMenuModal.tsx`).

- [ ] **Step 1: Extend the react-native + add imports.** Add `Modal` to the `react-native` import; add the Ionicons, auth, and service imports:

```tsx
import { FlatList, ActivityIndicator, View, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth/useAuth';
import {
  getUserMemberships,
  addVillageMember,
} from '@cultuvilla/shared/services/villageMemberService';
```

- [ ] **Step 2: Add state + membership fetch.** Inside `VillageDiscovery`, after the existing `reqId` ref, add:

```tsx
const { user } = useAuth();
const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
const [pendingJoin, setPendingJoin] = useState<Muni | null>(null);
const [joining, setJoining] = useState(false);

useEffect(() => {
  if (!user) {
    setJoinedIds(new Set());
    return;
  }
  let cancelled = false;
  void getUserMemberships(user.uid)
    .then((ms) => {
      if (!cancelled) setJoinedIds(new Set(ms.map((m) => m.municipalityId)));
    })
    .catch((e) =>
      console.log('[VillageDiscovery] getUserMemberships ERR', e?.code, e?.message),
    );
  return () => {
    cancelled = true;
  };
}, [user]);
```

- [ ] **Step 3: Rename `openMuni` → `viewMuni` and add join handlers.** Replace the existing `openMuni` function with:

```tsx
const viewMuni = (m: Muni) => {
  // Active villages → the rich village home; dormant municipalities → the "start" flow.
  const target: Href = m.communityActive
    ? { pathname: '/village/[villageId]', params: { villageId: m.id } }
    : { pathname: '/discover/start/[municipalityId]', params: { municipalityId: m.id } };
  router.push(target);
};

const onPressJoin = (m: Muni) => {
  if (!user) {
    router.push('/(auth)/login' as Href);
    return;
  }
  setPendingJoin(m);
};

const confirmJoin = async () => {
  if (!user || !pendingJoin) return;
  const id = pendingJoin.id;
  setJoining(true);
  try {
    await addVillageMember(id, user.uid);
    setJoinedIds((prev) => new Set(prev).add(id));
    setPendingJoin(null);
    router.push({ pathname: '/village/[villageId]', params: { villageId: id } });
  } finally {
    setJoining(false);
  }
};
```

- [ ] **Step 4: Replace the `muni` card render.** Swap the active-card body (the block returning the `<Pressable onPress={() => openMuni(m)}>` … with the Activo `<Text>`) for:

```tsx
const m = item.muni;
const joined = joinedIds.has(m.id);
return (
  <Pressable
    onPress={() => viewMuni(m)}
    className={`w-full rounded-md border bg-surface px-4 py-3 ${
      m.communityActive ? 'border-accent' : 'border-subtle'
    }`}
  >
    <HStack gap={3} className="items-center">
      <Escudo url={escudoThumbDisplayUrl(m)} size={40} fallbackInitial={m.name} />
      <VStack gap={1} className="flex-1">
        <Text>{m.name}</Text>
        <Text tone="muted" variant="bodySm">
          {m.province}
        </Text>
      </VStack>
      {m.communityActive ? (
        <HStack gap={1} className="items-center">
          <Pressable
            onPress={() => viewMuni(m)}
            accessibilityLabel={t('discover.viewVillage')}
            hitSlop={8}
            className="p-2"
          >
            <Ionicons name="eye-outline" size={22} color={ACCENT} />
          </Pressable>
          {joined ? (
            <View accessibilityLabel={t('discover.alreadyMember')} className="p-2">
              <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
            </View>
          ) : (
            <Pressable
              onPress={() => onPressJoin(m)}
              accessibilityLabel={t('discover.joinVillage')}
              hitSlop={8}
              className="p-2"
            >
              <Ionicons name="person-add-outline" size={22} color={ACCENT} />
            </Pressable>
          )}
        </HStack>
      ) : (
        <Text tone="muted" variant="bodySm">
          {t('discover.inactive')}
        </Text>
      )}
    </HStack>
  </Pressable>
);
```

(Nested `Pressable`s capture their own touch in RN/RN-Web, so tapping the eye/join button does not also fire the card's `onPress`.)

- [ ] **Step 5: Add the join-confirm modal.** Inside the outer `<View className="flex-1">`, after the `</FlatList>`, before the closing `</View>`, add:

```tsx
<Modal
  visible={pendingJoin !== null}
  transparent
  animationType="fade"
  onRequestClose={() => {
    if (!joining) setPendingJoin(null);
  }}
>
  <Pressable
    onPress={() => {
      if (!joining) setPendingJoin(null);
    }}
    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
    className="items-center justify-center px-8"
  >
    <Pressable onPress={() => {}} className="w-full rounded-lg bg-surface p-5">
      <VStack gap={3}>
        <Text variant="h3">{t('village.joinConfirm.title')}</Text>
        {pendingJoin ? <Text className="font-semibold">{pendingJoin.name}</Text> : null}
        <Text tone="muted">{t('village.joinConfirm.body')}</Text>
        <HStack gap={3} className="justify-end items-center">
          <Pressable
            onPress={() => setPendingJoin(null)}
            disabled={joining}
            className="px-4 py-2 rounded-md border border-subtle"
          >
            <Text>{t('village.joinConfirm.cancel')}</Text>
          </Pressable>
          <Pressable
            onPress={() => void confirmJoin()}
            disabled={joining}
            className="px-4 py-2 rounded-md bg-primary items-center"
          >
            {joining ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text tone="onAccent">{t('village.joinConfirm.confirm')}</Text>
            )}
          </Pressable>
        </HStack>
      </VStack>
    </Pressable>
  </Pressable>
</Modal>
```

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm check`
Expected: PASS (no TS/lint errors; in particular no unused `openMuni`/`activeBadge` references).

- [ ] **Step 7: Manual verification.** Using the `drive-android-avd` skill, open Buscar pueblo: confirm active cards show eye + person-plus (no "Activo" text), tapping the card or eye opens the village home, person-plus opens the confirm modal, confirming joins and lands on the village home, and a card for a village you already belong to shows a green check instead of person-plus.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/components/feature/VillageDiscovery.tsx
git commit -m "feat(discover): inline join from buscar pueblo card (eye + person-plus + confirm modal)"
```

### Task 3: Conditional "Cambiar de pueblo" menu item

**Files:**
- Modify: `apps/mobile/components/feature/UserMenuModal.tsx`

- [ ] **Step 1: Import the service + add count state.** Add to the imports:

```tsx
import { getUserMemberships } from '@cultuvilla/shared/services/villageMemberService';
```

After `const [photoURL, setPhotoURL] = useState<string | null>(null);` add:

```tsx
const [villageCount, setVillageCount] = useState(0);
```

- [ ] **Step 2: Fetch the count in the existing visible/user effect.** Extend the effect that loads the person (the one keyed on `[visible, user]`) so it also loads the membership count:

```tsx
useEffect(() => {
  if (!visible || !user) return;
  let cancelled = false;
  getPersonByUserId(user.uid).then((p) => {
    if (!cancelled) setPhotoURL(p?.photoURL ?? null);
  });
  getUserMemberships(user.uid)
    .then((ms) => {
      if (!cancelled) setVillageCount(ms.length);
    })
    .catch(() => {
      /* best-effort; leave count at 0 → item stays hidden */
    });
  return () => {
    cancelled = true;
  };
}, [visible, user]);
```

- [ ] **Step 3: Gate the switch-village item.** In the `villages` section, replace the static `switchVillage` item with a conditional spread so it only appears when the user belongs to more than one village:

```tsx
{
  title: t('menu.section.villages'),
  items: [
    ...((villageCount > 1
      ? [
          {
            icon: 'swap-horizontal-outline',
            label: t('menu.switchVillage'),
            onPress: () => close(() => router.push('/me/villages' as Href)),
          },
        ]
      : []) as MenuItem[]),
    {
      icon: 'search-outline',
      label: t('menu.findVillage'),
      onPress: () => close(() => router.push('/discover')),
    },
    {
      icon: 'paper-plane-outline',
      label: t('menu.myRequests'),
      comingSoon: true,
    },
  ],
},
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 5: Manual verification.** With the `drive-android-avd` skill: as a user in one village, open the user menu → "Cambiar de pueblo" is absent, "Buscar pueblo" present. As a user in two+ villages → "Cambiar de pueblo" is present.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/feature/UserMenuModal.tsx
git commit -m "feat(menu): hide Cambiar de pueblo for single-village users"
```
