# Profile screen: pueblo cards + "Unirse a otro pueblo"

**Date:** 2026-06-21
**Status:** Approved (design)

## Goal

Replace the plain "Mis pueblos" navigation button on the profile screen with a
horizontal scroll of image-forward pueblo cards (matching the pueblo-tab look)
plus a "Unirse a otro pueblo" card at the end.

## Current state

- `apps/mobile/app/(tabs)/profile.tsx` shows a "Mis pueblos" section that is just
  a `Pressable` row routing to `/me/villages` (lines 197–210).
- `apps/mobile/app/me/villages.tsx` is a vertical `FlatList` of plain rows; tapping
  a row calls `setActiveMunicipality` + `refreshProfile` + `router.replace('/(tabs)/village')`.
- `apps/mobile/components/feature/VillageSections.tsx` exports the image-forward
  `EntityCard` (over `BigCard`, which supports an `accent` border) and `AddCard`
  (dashed "add" card). Both are `w-36`, designed for horizontal scrolls.
- `apps/mobile/components/feature/profile/PersonaScroll.tsx` is the exact pattern
  to mirror: a horizontal `FlatList` of cards with an add-card footer and an
  empty branch.

## Design

### 1. New component — `VillagesScroll`

`apps/mobile/components/feature/profile/VillagesScroll.tsx`, mirroring
`PersonaScroll`.

Props:

```ts
interface VillageRow {
  municipalityId: string;
  name: string;
  escudoThumbUrl: string | null;
  role: VillageMemberRole; // 'user' | 'admin'
}

interface VillagesScrollProps {
  villages: VillageRow[];
  activeId: string | null;
  joinLabel: string;
  emptyLabel: string;
  badges: { active: string; admin: string; member: string };
  onPressVillage: (municipalityId: string) => void;
  onPressJoin: () => void;
}
```

Render:
- Non-empty: horizontal `FlatList`, one `EntityCard` per village, `AddCard`
  (`label={joinLabel}`) as `ListFooterComponent`.
- Empty: `AddCard` next to a muted `emptyLabel` (same shape as `PersonaScroll`'s
  empty branch).

Each card maps to `EntityCard`:
- `imageUri` = `escudoThumbUrl`
- `icon="map-outline"` (fallback when no escudo)
- `secondary` = active ? `badges.active` : (admin ? `badges.admin` : `badges.member`)
- `accent` = `municipalityId === activeId` (accent border + tinted secondary)
- `onPress` = `() => onPressVillage(municipalityId)`

### 2. `EntityCard` extension

Add an optional `accent?: boolean` prop to `EntityCard` in `VillageSections.tsx`,
passed straight through to `BigCard` (already supports it). No new card component,
no behavior change for existing call sites.

### 3. Profile screen wiring (`profile.tsx`)

- Add `refreshProfile` to the `useAuth()` destructure.
- In the existing `load()`, also fetch `getUserMemberships(user.uid)` and resolve
  each via `getMunicipality` for name + escudo (same logic as `me/villages.tsx`).
  Store rows in new state `villages: VillageRow[]`.
- Replace the section header + navigation `Pressable` (lines 197–210) with
  `<ProfileSectionHeader title={t('profile.villagesEntry')} />` +
  `<VillagesScroll … />`.
- `selectVillage(id)`: `setActiveMunicipality(user.uid, id)` → `refreshProfile()`
  → `router.replace('/(tabs)/village')` (mirrors `me/villages.tsx`).
- Join card → `router.push('/discover')`.
- `/me/villages` remains in code, no longer linked from profile.

### 4. i18n

- Reuse `profile.villagesEntry` ("Mis pueblos") for the section header.
- Reuse `me.villages.{activeBadge,adminBadge,memberBadge,empty}` for badges + empty.
- Add one new string `profile.villagesSection.join` = "Unirse a otro pueblo"
  (via the `i18n-add-string` skill, in every locale catalog).

### 5. Tests

Add `VillagesScroll` test (mirroring PersonaScroll/profile test patterns):
- renders one card per membership,
- marks the active village (accent / "Activo"),
- empty state shows the join card,
- join card press calls `onPressJoin`.

Update the existing profile test if it asserts on the old "Mis pueblos" button.

## Out of scope

- No change to the join flow itself (`/discover` → request-join screen).
- No change to `/me/villages` (kept, just unlinked from profile).
