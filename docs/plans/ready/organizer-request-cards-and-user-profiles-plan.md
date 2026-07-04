# Organizer-Request Cards + Viewable User Profiles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the super-admin organizer-request inbox cards show the requester's name/photo and link to their profile and the target village, and add a read-only `/user/[uid]` profile screen sharing the self-profile's layout.

**Architecture:** Extract the profile tab's data loader and presentational body into a reusable `useProfileData` hook + `ProfileView` component (variant `self`/`other`); render both from `(tabs)/profile.tsx` and a new `app/user/[uid].tsx`. Enrich the organizer card by resolving the requester's `person` client-side. Two Firestore reads that are cross-user-blocked today are opened: relax the `members` collection-group `list` rule, and add an approved-only news-by-organizer query.

**Tech Stack:** Expo Router v4, React Native, NativeWind, `@cultuvilla/shared` services, Firestore rules + composite indexes, vitest (shared), `@firebase/rules-unit-testing` (e2e rules).

## Global Constraints

- Service-layer ownership: screens/components/hooks never import `firebase/*` directly — go through `packages/shared/src/services/`.
- Strict TypeScript, no `any`, no `@ts-nocheck`.
- User-facing strings go through `useT()`; add keys to `packages/i18n/messages/es.json`.
- Design tokens / primitives: prefer `Avatar`, `Text`, `Pressable`, `HStack`, `VStack`; semantic classes where practical.
- Never start dev servers or emulator test suites (`pnpm test:*`, `expo start`). Run only the non-emulator vitest via the exact commands given.
- Conventional commits, header ≤ 100 chars.
- All work happens in the worktree `.claude/worktrees/organizer-cards-user-profiles` on branch `worktree-organizer-cards-user-profiles`.

---

## File Structure

- `packages/shared/src/services/newsService.ts` — add `getApprovedNewsPostsByOrganizer`.
- `packages/shared/test/services/newsService.test.ts` — test for the new query.
- `firestore.indexes.json` — composite index: `news` `organizerUserIds CONTAINS` + `status ASC`.
- `firestore.rules` — relax `match /{path=**}/members/{userId}` `list`.
- `packages/shared/test/e2e/villageMemberRules.test.ts` — update CG list expectations.
- `apps/mobile/lib/profile/useProfileData.ts` — **new** data hook (extracted from profile tab).
- `apps/mobile/components/feature/profile/ProfileView.tsx` — **new** presentational body (extracted).
- `apps/mobile/app/(tabs)/profile.tsx` — refactor to render `ProfileView variant="self"`.
- `apps/mobile/app/user/[uid].tsx` — **new** read-only profile route (`variant="other"`).
- `apps/mobile/app/solicitudes/index.tsx` — enrich organizer card + navigation.
- `packages/i18n/messages/es.json` — new strings.
- `packages/shared/src/services/_services-map.md`, `CHANGELOG.md` — docs.

---

## Task 1: Approved-only news-by-organizer query + index

**Files:**
- Modify: `packages/shared/src/services/newsService.ts` (after `getNewsPostsByOrganizer`, ~line 146)
- Test: `packages/shared/test/services/newsService.test.ts`
- Modify: `firestore.indexes.json`

**Interfaces:**
- Produces: `getApprovedNewsPostsByOrganizer(userId: string, options?: { limit?: number }): Promise<(NewsPostData & { id: string })[]>` — same shape/sort as `getNewsPostsByOrganizer` but only `status === 'approved'` docs, so it is readable for any user under the news rules.

- [ ] **Step 1: Write the failing test**

Add to `packages/shared/test/services/newsService.test.ts` (follow the existing in-memory-store patterns already in this file; find the describe block for `getNewsPostsByOrganizer` and add a sibling). The store keys are `news/<id>`; `getDocs` in this fake honors `where('organizerUserIds','array-contains',x)` and `where('status','==',x)` — verify by matching how the existing organizer test seeds data.

```ts
describe('getApprovedNewsPostsByOrganizer', () => {
  it('returns only approved posts where the user is an organizer, newest first', async () => {
    store = {};
    store['news/n1'] = {
      organizerUserIds: ['u1'], status: 'approved',
      submittedAt: new Date('2026-01-02'),
    };
    store['news/n2'] = {
      organizerUserIds: ['u1'], status: 'pending',
      submittedAt: new Date('2026-01-03'),
    };
    store['news/n3'] = {
      organizerUserIds: ['u1'], status: 'approved',
      submittedAt: new Date('2026-01-01'),
    };
    store['news/n4'] = {
      organizerUserIds: ['other'], status: 'approved',
      submittedAt: new Date('2026-01-04'),
    };
    const { getApprovedNewsPostsByOrganizer } = await import(
      '../../src/services/newsService'
    );
    const res = await getApprovedNewsPostsByOrganizer('u1');
    expect(res.map((p) => p.id)).toEqual(['n1', 'n3']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared test -- newsService`
Expected: FAIL — `getApprovedNewsPostsByOrganizer is not a function` (or the import is undefined).

> If the fake's `getDocs` does not support combining `array-contains` + `status` equality, extend the fake's query matcher in this test file the same way the existing multi-where tests do — do not weaken the assertion.

- [ ] **Step 3: Implement the query**

In `packages/shared/src/services/newsService.ts`, immediately after `getNewsPostsByOrganizer`:

```ts
// Approved-only variant of getNewsPostsByOrganizer — safe to run against
// ANOTHER user's uid, since the news read rule allows non-members to read
// only approved posts. Used by the read-only user profile ("other" variant).
export async function getApprovedNewsPostsByOrganizer(
  userId: string,
  options: { limit?: number } = {},
): Promise<(NewsPostData & { id: string })[]> {
  const q = query(
    newsCollection(getDb()),
    where('organizerUserIds', 'array-contains', userId),
    where('status', '==', 'approved'),
  );
  const snap = await getDocs(q);
  const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  posts.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  return options.limit ? posts.slice(0, options.limit) : posts;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared test -- newsService`
Expected: PASS.

- [ ] **Step 5: Add the composite index**

In `firestore.indexes.json`, add a new object to the `indexes` array next to the other `news` entries (after the `organizerUserIds CONTAINS` + `createdAt DESC` block ~line 176):

```json
    {
      "collectionGroup": "news",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizerUserIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/services/newsService.ts \
        packages/shared/test/services/newsService.test.ts \
        firestore.indexes.json
git commit -m "feat(shared): approved-only news-by-organizer query for public profiles"
```

---

## Task 2: Relax members collection-group list rule

**Files:**
- Modify: `firestore.rules` (`match /{path=**}/members/{userId}`, ~line 717)
- Test: `packages/shared/test/e2e/villageMemberRules.test.ts`

**Interfaces:**
- Produces (behavioral): any authenticated user may run a collection-group `list` on `members` (e.g. `collectionGroup(db,'members').where('userId','==',X)` for any X). Unauthenticated still denied. Enables the villages section on other users' profiles.

**Security note (intended):** `allow list: if isAuthenticated()` also permits an unfiltered dump of all member rows — Firestore rules cannot express "filtered to some single userId". This is the accepted tradeoff (member docs are already `allow read: if true`); the app only ever queries filtered by `userId`. Call this out in the PR.

- [ ] **Step 1: Update the rules test to the new posture (this is the failing spec)**

In `packages/shared/test/e2e/villageMemberRules.test.ts`, within `describe('firestore.rules — members collection-group', ...)`:

Replace the `'signed-in user cannot list ALL memberships unfiltered'` test with:

```ts
  it('signed-in user can list ANOTHER user\'s memberships via collection group', async () => {
    await seedAliceMemberships();
    const db = asUser(getEnv(), BOB);
    await assertSucceeds(
      getDocs(query(collectionGroup(db, 'members'), where('userId', '==', ALICE))),
    );
  });
```

Ensure a `BOB` constant exists (mirror the existing `ALICE` const near the top of the file; add `const BOB = 'bob';` if absent). Keep the existing `'signed-in user can list their own memberships'` and `'anonymous user cannot list memberships'` tests unchanged.

- [ ] **Step 2: Run the rules test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared test:rules -- villageMemberRules`
Expected: FAIL — Bob is denied listing Alice's memberships under the current `resource.data.userId == request.auth.uid` rule.

> This is an emulator-backed rules test. If the emulator is not already running and you cannot start it (per Global Constraints), ask the user to run `pnpm --filter @cultuvilla/shared test:rules -- villageMemberRules` and paste the result rather than starting the emulator yourself.

- [ ] **Step 3: Relax the rule**

In `firestore.rules`, change the `members` collection-group block:

```
    match /{path=**}/members/{userId} {
      allow list: if isAuthenticated();
    }
```

Update the adjacent comment block (~lines 710-716) to state that authenticated users may list member rows across collection groups (member docs are individually public); do not leave the stale "list only their own rows" wording.

- [ ] **Step 4: Run the rules test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared test:rules -- villageMemberRules`
Expected: PASS (all four tests: own, other-user, anonymous-denied, direct-doc-read).

- [ ] **Step 5: Commit**

```bash
git add firestore.rules packages/shared/test/e2e/villageMemberRules.test.ts
git commit -m "feat(rules): allow authenticated members collection-group list for public profiles"
```

---

## Task 3: `useProfileData` hook (extract the profile loader)

**Files:**
- Create: `apps/mobile/lib/profile/useProfileData.ts`
- Reference (source of truth to move from): `apps/mobile/app/(tabs)/profile.tsx:44-161`

**Interfaces:**
- Consumes: existing services `getPersonByUserId`, `getPersonsByCreator`, `getEventsByOrganizer`, `getNewsPostsByOrganizer`, `getApprovedNewsPostsByOrganizer` (Task 1), `getUserMemberships`, `getMunicipality`, `getOrganizationsByMunicipality`, `getOrgMembershipsByUserInMunicipality`; models `escudoFullUrl`, `hasManualEscudo`.
- Produces:
  ```ts
  type ProfileData = {
    selfPerson: (PersonData & { id: string }) | null; // person-of-record for the uid
    allPersonas: (PersonData & { id: string })[];
    eventsCreated: number | null;
    managedEvents: ManagedEvent[];
    newsCount: number | null;
    createdNews: CreatedNews[];
    newsError: boolean;
    orgs: MemberOrg[];    // { id; name; type: OrganizationType; imageURL: string | null; role: OrgMemberRole }
    villages: VillageRow[];
    loading: boolean;
    reload: () => Promise<void>;
  };
  function useProfileData(
    uid: string | null,
    activeMunicipalityId: string | null,
    variant: 'self' | 'other',
  ): ProfileData;
  ```

- [ ] **Step 1: Create the hook by lifting the tab's load logic**

Create `apps/mobile/lib/profile/useProfileData.ts`. Move the state + `load` callback body from `profile.tsx:60-171` verbatim, with these parameterizations:
- Replace every `user.uid` with the `uid` argument; early-return empty/`loading:false` when `uid` is null.
- Replace `activeMunicipalityId` (currently `profile?.activeMunicipalityId`) with the `activeMunicipalityId` argument.
- **News branch:** when `variant === 'other'`, call `getApprovedNewsPostsByOrganizer(uid)` instead of `getNewsPostsByOrganizer(uid)`. Keep the existing try/catch that sets `newsError` on denial (self keeps the all-status query + its known organizer-denial fallback).
- **Villages branch:** keep `getUserMemberships(uid)` for both variants (Task 2 makes it work cross-user). Keep the existing try/catch shape; if it throws, set `villages: []` (do not crash).
- Move the `MemberOrg`, `PersonDoc` type aliases and the `ManagedEvent`/`CreatedNews`/`VillageRow` imports along with it.
- Export `reload` (the memoized `load`). Keep the `useFocusEffect(() => reload())` inside the hook so both screens refresh on focus.

Type imports to include:
```ts
import type { OrganizationType, OrgMemberRole } from '@cultuvilla/shared/models/organization';
import type { PersonData } from '@cultuvilla/shared/models/person';
import type { ManagedEvent } from '../../components/feature/profile/ManagedEventsScroll';
import type { CreatedNews } from '../../components/feature/profile/CreatedNewsScroll';
import type { VillageRow } from '../../components/feature/profile/VillagesScroll';
```

- [ ] **Step 2: Typecheck the hook in isolation**

Run: `pnpm app:typecheck`
Expected: PASS (the hook compiles; `profile.tsx` still has its own copy for now, so no consumer breakage yet).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/profile/useProfileData.ts
git commit -m "refactor(mobile): extract useProfileData hook from profile tab"
```

---

## Task 4: `ProfileView` component + refactor the self tab onto it

**Files:**
- Create: `apps/mobile/components/feature/profile/ProfileView.tsx`
- Modify: `apps/mobile/app/(tabs)/profile.tsx`
- Reference: current `profile.tsx:213-382` (the JSX body to move)

**Interfaces:**
- Consumes: `useProfileData` (Task 3), existing profile subcomponents (`ProfileHeader`, `ProfileStatsRow`, `PersonaScroll`, `ProfileSectionHeader`, `ManagedEventsScroll`, `CreatedNewsScroll`, `VillagesScroll`, `Section`, `EntityCard`).
- Produces:
  ```ts
  type ProfileViewProps = {
    uid: string;
    activeMunicipalityId: string | null;
    variant: 'self' | 'other';
    fallbackName: string;
    // self-only handlers (ignored when variant==='other'):
    uploading?: boolean;
    onChangePhoto?: () => void;
    onShare?: () => void;
    onSelectVillage?: (municipalityId: string) => void;
  };
  function ProfileView(props: ProfileViewProps): JSX.Element;
  ```

- [ ] **Step 1: Create `ProfileView` with the shared body + variant gates**

Create `apps/mobile/components/feature/profile/ProfileView.tsx`. It calls `useProfileData(uid, activeMunicipalityId, variant)` and renders the scroll body moved from `profile.tsx:216-380`, with these variant conditionals (`const isSelf = variant === 'self'`):

- **Avatar:** pass `onPressAvatar={isSelf ? onChangePhoto : undefined}` and `uploading={isSelf ? uploading : false}` to `ProfileHeader`.
- **Edit/Share action row** (`profile.tsx:235-274`): wrap in `{isSelf && selfPerson ? (...) : null}`. Keep the existing Edit button (`router.push('/person/${selfPerson.id}')`) and Share button (`onShare`), but Share's `onPress` becomes `() => onShare?.()`.
- **Personas scroll:** `onPressPersona={(id) => router.push('/person/' + id)}` for both variants. `onPressAdd` and the add affordance only for self — pass `addLabel={isSelf ? t('profile.personasSection.add') : undefined}` and `onPressAdd={isSelf ? () => router.push('/person/new') : undefined}`. If `PersonaScroll` always shows an add tile, add an `showAdd?: boolean` prop to `PersonaScroll` defaulting to `true` and pass `showAdd={isSelf}`. (Check `PersonaScroll.tsx` first; only add the prop if an add tile is otherwise always rendered.)
- **Villages scroll:** `onPressVillage={isSelf ? (id) => onSelectVillage?.(id) : (id) => router.push({ pathname: '/village/[villageId]', params: { villageId: id } })}`. `onPressJoin={isSelf ? () => router.push('/discover') : undefined}` (hide the join tile for other, mirroring the `showAdd` approach if `VillagesScroll` always renders it).
- Everything else (stats row, biography, managed events, created news, grupos/peñas sections) renders identically for both variants using the hook's data.

- [ ] **Step 2: Refactor `profile.tsx` to consume `ProfileView`**

Rewrite `apps/mobile/app/(tabs)/profile.tsx` so it keeps only: auth, `onChangePhoto`, `onShare` (the `share(getPersonViewLink(...), buildDisplayName(...))` call — but note `selfPerson` now lives in the hook; keep a local `getPersonByUserId` fetch only for the share label, or expose `selfPerson` via the hook and lift the share handler into `ProfileView` for self). Simplest: have `ProfileView` own the share handler internally for self using its `selfPerson` + `useShareDeepLink`, and drop `onShare` from props. Choose that: move `useShareDeepLink` + share logic into `ProfileView` behind `isSelf`. Then `profile.tsx` becomes:

```tsx
export default function ProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useT();
  const [uploading, setUploading] = useState(false);
  const activeMunicipalityId = profile?.activeMunicipalityId ?? null;

  async function onChangePhoto(selfPersonId: string) { /* moved from current onChangePhoto, param'd by person id */ }
  async function selectVillage(municipalityId: string) {
    if (!user) return;
    await setActiveMunicipality(user.uid, municipalityId);
    await refreshProfile();
    router.replace('/(tabs)/village');
  }
  if (!user) return null;
  return (
    <Screen padded={false} topInset={false} bottomInset={false}>
      <AppHeader centerLabel={t('header.profile')} />
      <ProfileView
        uid={user.uid}
        activeMunicipalityId={activeMunicipalityId}
        variant="self"
        fallbackName={profile?.displayName ?? user.email ?? ''}
        uploading={uploading}
        onChangePhoto={/* wire to onChangePhoto using hook's selfPerson */}
        onSelectVillage={selectVillage}
      />
    </Screen>
  );
}
```

> `onChangePhoto` needs the `selfPerson.id`, which now lives in the hook. Cleanest: move the whole photo-upload flow (`pickImageAsBlob` → `uploadUserPhoto` → `updatePerson` → reload) into `ProfileView` behind `isSelf`, using the hook's `selfPerson` and `reload`, and drop `onChangePhoto`/`uploading` from props too. Prefer this — it keeps `profile.tsx` thin and colocates self behavior in one place. Final self-only props then reduce to just `onSelectVillage` (village switching needs `refreshProfile` + `router.replace`, which are screen-level). Keep `onSelectVillage`.

- [ ] **Step 3: Typecheck + run the mobile jest suite**

Run: `pnpm app:typecheck && pnpm app:test`
Expected: PASS. Fix any prop-drift (e.g. a subcomponent prop you made optional).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/feature/profile/ProfileView.tsx \
        apps/mobile/app/(tabs)/profile.tsx \
        apps/mobile/components/feature/profile/PersonaScroll.tsx \
        apps/mobile/components/feature/profile/VillagesScroll.tsx
git commit -m "refactor(mobile): share profile body via ProfileView (self variant)"
```

---

## Task 5: Read-only `/user/[uid]` route

**Files:**
- Create: `apps/mobile/app/user/[uid].tsx`

**Interfaces:**
- Consumes: `ProfileView` (Task 4, `variant="other"`), `getUserProfile` (`packages/shared/src/services/userService.ts`), `getPersonByUserId`, `buildDisplayName`, `ScreenHeader`.

- [ ] **Step 1: Create the route**

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, Text } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { ProfileView } from '../../components/feature/profile/ProfileView';
import { useT } from '../../lib/i18n';
import { getUserProfile } from '@cultuvilla/shared/services/userService';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { buildDisplayName } from '@cultuvilla/shared/models/person';

export default function UserProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { t } = useT();
  const [headerName, setHeaderName] = useState('');
  const [activeMunicipalityId, setActiveMunicipalityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!uid) return;
    setLoading(true);
    void (async () => {
      const [profile, person] = await Promise.all([
        getUserProfile(uid),
        getPersonByUserId(uid),
      ]);
      if (cancelled) return;
      if (!profile) setNotFound(true);
      setActiveMunicipalityId(profile?.activeMunicipalityId ?? null);
      setHeaderName(person ? buildDisplayName(person) : profile?.displayName ?? '');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [uid]);

  if (!uid) return null;

  return (
    <Screen padded={false} topInset={false} bottomInset={false}>
      <ScreenHeader title={headerName || t('userProfile.title')} />
      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      ) : notFound ? (
        <View className="p-4"><Text tone="muted">{t('userProfile.notFound')}</Text></View>
      ) : (
        <ProfileView
          uid={uid}
          activeMunicipalityId={activeMunicipalityId}
          variant="other"
          fallbackName={headerName}
        />
      )}
    </Screen>
  );
}
```

The distinct header comes from `ScreenHeader` (back button + person's name), contrasted with the self tab's `AppHeader` accent bar.

- [ ] **Step 2: Add i18n keys**

In `packages/i18n/messages/es.json`, add a top-level `userProfile` object:

```json
  "userProfile": {
    "title": "Perfil",
    "notFound": "No se encontró el usuario"
  },
```

- [ ] **Step 3: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/user/[uid].tsx packages/i18n/messages/es.json
git commit -m "feat(mobile): read-only /user/[uid] profile route"
```

---

## Task 6: Enrich the organizer-request inbox card

**Files:**
- Modify: `apps/mobile/app/solicitudes/index.tsx`
- Modify: `packages/i18n/messages/es.json`

**Interfaces:**
- Consumes: `getPersonByUserId` (`personService`), `buildDisplayName` (`@cultuvilla/shared/models/person`), `Avatar` primitive, `Pressable`, `router`, `ProfileView` route `/user/[uid]`, village route `/village/[villageId]`.

- [ ] **Step 1: Resolve requester persons into a map**

In `solicitudes/index.tsx`, add state next to `municipalityNames`:

```tsx
const [requesterByUid, setRequesterByUid] = useState<
  Record<string, { name: string; photoURL: string | null }>
>({});
```

In `loadData`, after `setOrganizerRows(fetchedOrganizerRows)`, resolve each requester (mirror the municipality-name resolution):

```tsx
const requesterFetches = fetchedOrganizerRows.map(async (r) => {
  const p = await getPersonByUserId(r.userId);
  return [r.userId, {
    name: p ? buildDisplayName(p) : r.userId,
    photoURL: p?.photoURL ?? null,
  }] as const;
});
const resolvedRequesters = await Promise.all(requesterFetches);
if (resolvedRequesters.length > 0) {
  setRequesterByUid((prev) => {
    const next = { ...prev };
    for (const [id, v] of resolvedRequesters) next[id] = v;
    return next;
  });
}
```

Add imports:
```tsx
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { buildDisplayName } from '@cultuvilla/shared/models/person';
import { Avatar } from '../../components/primitives';
import { Pressable } from '../../components/primitives';
import { router } from 'expo-router';
```
(Confirm `Avatar`/`Pressable` are exported from `../../components/primitives`; if not, import `Avatar` from `../../components/primitives/Avatar`.)

- [ ] **Step 2: Rewrite the organizer card JSX (make card + village clickable)**

Replace the organizer-row `VStack` body (`solicitudes/index.tsx:318-354`) with:

```tsx
const requester = requesterByUid[row.userId];
const name = requester?.name ?? row.userId;
return (
  <Pressable
    key={row.id}
    onPress={() => router.push(`/user/${row.userId}`)}
    className="bg-surface border border-subtle rounded-xl p-3"
  >
    <VStack gap={2}>
      <HStack gap={2} className="items-center">
        <Avatar uri={requester?.photoURL ?? undefined} size={40} initials={name.charAt(0).toUpperCase()} />
        <VStack gap={0} className="flex-1">
          <Text className="font-semibold">{name}</Text>
          <HStack gap={1} className="items-center flex-wrap">
            <Text tone="muted" variant="caption">{t('solicitudes.wantsToAdminister')}</Text>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                router.push({ pathname: '/village/[villageId]', params: { villageId: row.municipalityId } });
              }}
            >
              <Text variant="caption" style={{ textDecorationLine: 'underline' }}>
                {municipalityName}
              </Text>
            </Pressable>
          </HStack>
        </VStack>
      </HStack>
      {row.motivation && row.motivation.trim().length > 0 && (
        <VStack gap={0}>
          <Text tone="muted" variant="caption">{t('solicitudes.motivation')}</Text>
          <Text className="italic text-sm">"{row.motivation}"</Text>
        </VStack>
      )}
      <HStack gap={2}>
        <Button onPress={() => handleOrganizerDecide(row, 'approved')} loading={busyKey === key}>
          {t('solicitudes.approve')}
        </Button>
        <Button variant="ghost" onPress={() => handleOrganizerDecide(row, 'rejected')} loading={busyKey === key}>
          {t('solicitudes.reject')}
        </Button>
      </HStack>
    </VStack>
  </Pressable>
);
```

> Verify the `Button`'s `onPress` does not bubble to the card `Pressable`. RN touchables inside a parent `Pressable` capture their own press and do not propagate, so approve/reject won't trigger navigation. If the project's `Button`/`Pressable` primitive does bubble, wrap the `HStack` of buttons in a `<View onStartShouldSetResponder={() => true}>`. Confirm behavior when running (Task 7 verify).

- [ ] **Step 3: Add i18n key**

In `packages/i18n/messages/es.json` under `solicitudes`, add:
```json
  "wantsToAdminister": "quiere administrar",
```
(The full-sentence `organizerRow` key stays for any other consumer; the card no longer uses it.)

- [ ] **Step 4: Typecheck + jest**

Run: `pnpm app:typecheck && pnpm app:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/solicitudes/index.tsx packages/i18n/messages/es.json
git commit -m "feat(mobile): rich organizer-request cards with requester + village links"
```

---

## Task 7: Docs, full gate, and PR

**Files:**
- Modify: `packages/shared/src/services/_services-map.md`, `CHANGELOG.md`

- [ ] **Step 1: Update docs**

- Add `getApprovedNewsPostsByOrganizer` to the `newsService` entry in `packages/shared/src/services/_services-map.md`.
- Under `CHANGELOG.md` `## [Unreleased]`: note (a) organizer-request cards now show requester name/photo and link to user + village, (b) new read-only user profile screen, (c) members collection-group listing is now open to authenticated users (security-posture change).

- [ ] **Step 2: Run the full gate**

Run: `pnpm check`
Expected: lint + typecheck + tests + build all pass. (If the emulator-backed rules tests in `pnpm check` can't run in this environment, ask the user to run `pnpm check` and paste the result — do not skip it.)

- [ ] **Step 3: Verify the feature end-to-end**

Use the `verify` skill / `drive-android-avd` to drive the app: as a super admin, open Solicitudes → Recibidas, confirm an organizer card shows the requester's name + photo, tapping the card opens `/user/[uid]` (read-only, distinct header, sections populated incl. villages + approved news), and tapping the village name opens the village profile. Confirm approve/reject still work without triggering navigation. If you cannot drive the app, list these as manual steps in the PR test plan.

- [ ] **Step 4: Rebase + push + open PR**

```bash
git fetch origin develop && git rebase origin/develop
pnpm check
git push -u origin worktree-organizer-cards-user-profiles
gh pr create --base develop --title "feat: rich organizer-request cards + viewable user profiles" --body "<what/why/tests/test-plan per AGENTS.md; call out the members CG rule relaxation>"
```

- [ ] **Step 5: Retire the plan**

After merge, distil durable rationale into `docs/decisions/` if warranted and delete this plan + the spec from `docs/plans/` (per `managing-plans-lifecycle`).

---

## Self-Review

- **Spec coverage:** Card name/photo → Task 6; card→user nav → Tasks 5+6; village reference+nav → Task 6; user profile route → Tasks 3–5; parity villages → Task 2; parity news → Task 1; shared component → Tasks 3–4. All covered.
- **Type consistency:** `getApprovedNewsPostsByOrganizer` signature identical across Task 1 and Task 3 consumption; `ProfileView`/`useProfileData` prop and return types match between Tasks 3–5; `requesterByUid` shape consistent in Task 6.
- **Placeholders:** none — every code step has concrete content.
- **Open verification points flagged inline:** the fake-store multi-where support (Task 1), `PersonaScroll`/`VillagesScroll` add-tile props (Task 4), and touchable bubbling (Task 6) are called out to check during execution rather than assumed.
