# Profile Pueblo Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain "Mis pueblos" navigation button on the profile screen with a horizontal scroll of image-forward pueblo cards plus a "Unirse a otro pueblo" card.

**Architecture:** A new `VillagesScroll` profile component mirrors the existing `PersonaScroll` pattern — a horizontal `FlatList` of `EntityCard`s (the pueblo-tab card) with an `AddCard` footer. `profile.tsx` loads the user's memberships and wires tap → switch active village + open the pueblo tab. `EntityCard` gains one optional `accent` passthrough prop for the active village's border.

**Tech Stack:** Expo / React Native, NativeWind, expo-router, `@testing-library/react-native` + Jest, `@cultuvilla/shared` services.

## Global Constraints

- Mobile tests run with Jest from `apps/mobile`. Run a single file with: `pnpm --filter cultuvilla-mobile test -- <path-or-pattern>`.
- Only one locale catalog exists: `packages/i18n/messages/es.json`. Message keys are untyped strings; no codegen step.
- NativeWind gotcha: never put styles on `className` for `Animated` components — not relevant here (no Animated), but keep styles on `style`/`className` exactly as the existing cards do.
- Follow existing import style: `escudoThumbDisplayUrl` from `@cultuvilla/shared/models/municipality`; `getUserMemberships` / `UserMembership` from `@cultuvilla/shared/services/villageMemberService`; `getMunicipality` from `@cultuvilla/shared/services/municipalityService`; `setActiveMunicipality` from `@cultuvilla/shared/services/userService`.
- `EntityCard`, `AddCard`, `BigCard` live in `apps/mobile/components/feature/VillageSections.tsx`. `BigCard` already supports an `accent?: boolean` border prop.

---

### Task 1: Add the "Unirse a otro pueblo" i18n string

**Files:**
- Modify: `packages/i18n/messages/es.json` (the `profile` object, near `villagesEntry` at line 389)

**Interfaces:**
- Produces: message key `profile.villagesSection.join` → "Unirse a otro pueblo".

- [ ] **Step 1: Add the key**

In `packages/i18n/messages/es.json`, inside the `"profile"` object, add a `villagesSection` block. The `villagesEntry` line currently reads:

```json
    "villagesEntry": "Mis pueblos",
```

Change it to add the new block immediately after:

```json
    "villagesEntry": "Mis pueblos",
    "villagesSection": {
      "join": "Unirse a otro pueblo"
    },
```

- [ ] **Step 2: Verify JSON is still valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/i18n/messages/es.json','utf8')); console.log('ok')"`
Expected: prints `ok`

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "i18n(mobile): add profile.villagesSection.join string"
```

---

### Task 2: `VillagesScroll` component (+ `EntityCard` accent prop)

**Files:**
- Modify: `apps/mobile/components/feature/VillageSections.tsx` (the `EntityCard` function, ~lines 172-194)
- Create: `apps/mobile/components/feature/profile/VillagesScroll.tsx`
- Test: `apps/mobile/components/feature/profile/__tests__/VillagesScroll.test.tsx`

**Interfaces:**
- Consumes: `EntityCard` and `AddCard` from `../VillageSections`; `UserMembership` from `@cultuvilla/shared/services/villageMemberService` (only its `role` field type is reused via `VillageRow`).
- Produces:

```ts
export interface VillageRow {
  municipalityId: string;
  name: string;
  escudoThumbUrl: string | null;
  role: 'admin' | 'user';
}

export interface VillagesScrollProps {
  villages: VillageRow[];
  activeId: string | null;
  joinLabel: string;
  emptyLabel: string;
  badges: { active: string; admin: string; member: string };
  onPressVillage: (municipalityId: string) => void;
  onPressJoin: () => void;
}

export function VillagesScroll(props: VillagesScrollProps): JSX.Element;
```

- [ ] **Step 1: Add `accent` passthrough to `EntityCard`**

In `apps/mobile/components/feature/VillageSections.tsx`, the `EntityCard` function currently is:

```tsx
export function EntityCard({
  label,
  sub,
  icon,
  imageUri,
  onPress,
}: {
  label: string;
  sub?: string;
  icon: keyof typeof Ionicons.glyphMap;
  imageUri?: string | null;
  onPress?: () => void;
}) {
  return (
    <BigCard
      label={label}
      imageUri={imageUri}
      fallback={<Ionicons name={icon} size={44} color={ACCENT} />}
      secondary={sub}
      onPress={onPress}
    />
  );
}
```

Replace it with (adds `accent`):

```tsx
export function EntityCard({
  label,
  sub,
  icon,
  imageUri,
  accent,
  onPress,
}: {
  label: string;
  sub?: string;
  icon: keyof typeof Ionicons.glyphMap;
  imageUri?: string | null;
  accent?: boolean;
  onPress?: () => void;
}) {
  return (
    <BigCard
      label={label}
      imageUri={imageUri}
      fallback={<Ionicons name={icon} size={44} color={ACCENT} />}
      secondary={sub}
      accent={accent}
      onPress={onPress}
    />
  );
}
```

- [ ] **Step 2: Write the failing test**

Create `apps/mobile/components/feature/profile/__tests__/VillagesScroll.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { VillagesScroll, type VillageRow } from '../VillagesScroll';

jest.mock('../../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (key: string) => key }),
}));

const BADGES = { active: 'Activo', admin: 'Administrador', member: 'Miembro' };

const ROWS: VillageRow[] = [
  { municipalityId: 'm1', name: 'Pueblo Uno', escudoThumbUrl: null, role: 'user' },
  { municipalityId: 'm2', name: 'Pueblo Dos', escudoThumbUrl: null, role: 'admin' },
];

function setup(overrides: Partial<React.ComponentProps<typeof VillagesScroll>> = {}) {
  const onPressVillage = jest.fn();
  const onPressJoin = jest.fn();
  const utils = render(
    <VillagesScroll
      villages={ROWS}
      activeId="m1"
      joinLabel="Unirse a otro pueblo"
      emptyLabel="Aún no perteneces a ningún pueblo"
      badges={BADGES}
      onPressVillage={onPressVillage}
      onPressJoin={onPressJoin}
      {...overrides}
    />,
  );
  return { ...utils, onPressVillage, onPressJoin };
}

describe('VillagesScroll', () => {
  it('renders a card per village', () => {
    const { getByText } = setup();
    expect(getByText('Pueblo Uno')).toBeTruthy();
    expect(getByText('Pueblo Dos')).toBeTruthy();
  });

  it('shows the active badge on the active village and the role badge otherwise', () => {
    const { getByText } = setup();
    expect(getByText('Activo')).toBeTruthy(); // m1 is active
    expect(getByText('Administrador')).toBeTruthy(); // m2 is admin, not active
  });

  it('renders the join card and fires onPressJoin when pressed', () => {
    const { getByText, onPressJoin } = setup();
    fireEvent.press(getByText('Unirse a otro pueblo'));
    expect(onPressJoin).toHaveBeenCalled();
  });

  it('fires onPressVillage with the municipalityId when a card is pressed', () => {
    const { getByText, onPressVillage } = setup();
    fireEvent.press(getByText('Pueblo Dos'));
    expect(onPressVillage).toHaveBeenCalledWith('m2');
  });

  it('empty state still shows the join card and the empty label', () => {
    const { getByText } = setup({ villages: [] });
    expect(getByText('Unirse a otro pueblo')).toBeTruthy();
    expect(getByText('Aún no perteneces a ningún pueblo')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile test -- VillagesScroll`
Expected: FAIL — cannot find module `../VillagesScroll`.

- [ ] **Step 4: Create the component**

Create `apps/mobile/components/feature/profile/VillagesScroll.tsx`:

```tsx
import { FlatList, View } from 'react-native';
import { Text } from '../../primitives';
import { EntityCard, AddCard } from '../VillageSections';

export interface VillageRow {
  municipalityId: string;
  name: string;
  escudoThumbUrl: string | null;
  role: 'admin' | 'user';
}

export interface VillagesScrollProps {
  villages: VillageRow[];
  activeId: string | null;
  joinLabel: string;
  emptyLabel: string;
  badges: { active: string; admin: string; member: string };
  onPressVillage: (municipalityId: string) => void;
  onPressJoin: () => void;
}

export function VillagesScroll({
  villages,
  activeId,
  joinLabel,
  emptyLabel,
  badges,
  onPressVillage,
  onPressJoin,
}: VillagesScrollProps) {
  function secondaryFor(row: VillageRow): string {
    if (row.municipalityId === activeId) return badges.active;
    return row.role === 'admin' ? badges.admin : badges.member;
  }

  if (villages.length === 0) {
    return (
      <View className="flex-row items-center px-4">
        <AddCard label={joinLabel} onPress={onPressJoin} />
        <Text tone="muted" className="flex-1 ml-2">
          {emptyLabel}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={villages}
      keyExtractor={(v) => v.municipalityId}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      renderItem={({ item }) => (
        <EntityCard
          label={item.name}
          sub={secondaryFor(item)}
          icon="map-outline"
          imageUri={item.escudoThumbUrl}
          accent={item.municipalityId === activeId}
          onPress={() => onPressVillage(item.municipalityId)}
        />
      )}
      ListFooterComponent={<AddCard label={joinLabel} onPress={onPressJoin} />}
    />
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile test -- VillagesScroll`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/feature/VillageSections.tsx apps/mobile/components/feature/profile/VillagesScroll.tsx apps/mobile/components/feature/profile/__tests__/VillagesScroll.test.tsx
git commit -m "feat(mobile): VillagesScroll card row for profile + EntityCard accent prop"
```

---

### Task 3: Wire `VillagesScroll` into the profile screen

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx`
- Modify: `apps/mobile/app/(tabs)/__tests__/profile.test.tsx`

**Interfaces:**
- Consumes: `VillagesScroll` / `VillageRow` from `../../components/feature/profile/VillagesScroll`; `getUserMemberships` from `@cultuvilla/shared/services/villageMemberService`; `getMunicipality` from `@cultuvilla/shared/services/municipalityService`; `setActiveMunicipality` from `@cultuvilla/shared/services/userService`; `escudoThumbDisplayUrl` from `@cultuvilla/shared/models/municipality`; `refreshProfile` from `useAuth()`.

- [ ] **Step 1: Update the profile test mocks (failing test)**

In `apps/mobile/app/(tabs)/__tests__/profile.test.tsx`, the new screen imports services and a component the current test doesn't mock, which would break the suite. Add these mocks and a regression test.

First, extend the `useAuth` mock so `refreshProfile` exists (line 56-59 area). Replace:

```tsx
const mockUser = { uid: 'uid-1', email: 'a@b.test', displayName: null };
const mockProfile = { activeMunicipalityId: null };
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({ user: mockUser, profile: mockProfile }),
}));
```

with:

```tsx
const mockUser = { uid: 'uid-1', email: 'a@b.test', displayName: null };
const mockProfile = { activeMunicipalityId: null };
const mockRefreshProfile = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({ user: mockUser, profile: mockProfile, refreshProfile: mockRefreshProfile }),
}));
```

Then add the new service + component mocks alongside the existing ones (after the `orgMemberService` mock at line 45):

```tsx
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  getUserMemberships: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipality: jest.fn().mockResolvedValue(null),
}));
jest.mock('@cultuvilla/shared/services/userService', () => ({
  setActiveMunicipality: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/models/municipality', () => ({
  escudoThumbDisplayUrl: jest.fn().mockReturnValue(null),
}));
```

And mock the new component so the existing photo test stays isolated (after the `PersonaScroll` mock at line 73):

```tsx
jest.mock('../../../components/feature/profile/VillagesScroll', () => ({
  VillagesScroll: () => null,
}));
```

- [ ] **Step 2: Add a regression test for membership loading**

Add this `describe` block at the end of `profile.test.tsx`:

```tsx
describe('ProfileScreen — mis pueblos', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads the user memberships on mount', async () => {
    const personService = require('@cultuvilla/shared/services/personService');
    const villageMemberService = require('@cultuvilla/shared/services/villageMemberService');
    (personService.getPersonByUserId as jest.Mock).mockResolvedValue(null);

    render(<ProfileScreen />);

    await waitFor(() => {
      expect(villageMemberService.getUserMemberships).toHaveBeenCalledWith('uid-1');
    });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile test -- profile.test`
Expected: FAIL — `getUserMemberships` is never called (screen doesn't load memberships yet).

- [ ] **Step 4: Add imports to `profile.tsx`**

In `apps/mobile/app/(tabs)/profile.tsx`, after the existing `orgMemberService` import (line 26) add:

```tsx
import { getUserMemberships } from '@cultuvilla/shared/services/villageMemberService';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { setActiveMunicipality } from '@cultuvilla/shared/services/userService';
import { escudoThumbDisplayUrl } from '@cultuvilla/shared/models/municipality';
import { VillagesScroll, type VillageRow } from '../../components/feature/profile/VillagesScroll';
```

- [ ] **Step 5: Add state, loading, and the select handler**

In the component body, change the `useAuth()` destructure (line 32) from:

```tsx
  const { user, profile } = useAuth();
```

to:

```tsx
  const { user, profile, refreshProfile } = useAuth();
```

Add a state hook next to the others (after the `orgs` state, line 39):

```tsx
  const [villages, setVillages] = useState<VillageRow[]>([]);
```

Inside `load()`, after the participations block and before the `if (activeMunicipalityId)` org block (around line 67), add membership loading:

```tsx
      const memberships = await withFirestoreErrorLog('profile:getUserMemberships', () =>
        getUserMemberships(user.uid),
      );
      const villageRows = await Promise.all(
        memberships.map(async (m) => {
          const muni = await withFirestoreErrorLog('profile:getMunicipality', () =>
            getMunicipality(m.municipalityId),
          );
          return {
            municipalityId: m.municipalityId,
            name: muni?.name ?? m.municipalityId,
            escudoThumbUrl: muni ? escudoThumbDisplayUrl(muni) : null,
            role: m.role,
          } satisfies VillageRow;
        }),
      );
      setVillages(villageRows);
```

Add the select handler after `onChangePhoto` (around line 126):

```tsx
  async function selectVillage(municipalityId: string) {
    if (!user) return;
    await setActiveMunicipality(user.uid, municipalityId);
    await refreshProfile();
    router.replace('/(tabs)/village');
  }
```

- [ ] **Step 6: Replace the "Mis pueblos" button with `VillagesScroll`**

In `profile.tsx`, replace the section header + navigation `Pressable` block (lines 197-210):

```tsx
        <ProfileSectionHeader title={t('profile.villagesEntry')} />
        <View className="px-4">
          <Pressable
            onPress={() => router.push('/me/villages')}
            accessibilityRole="button"
            accessibilityLabel={t('profile.villagesEntry')}
          >
            <View className="flex-row items-center bg-surface border border-subtle rounded-xl p-3">
              <Ionicons name="map-outline" size={20} color="#0f172a" />
              <Text className="ml-3 flex-1">{t('profile.villagesEntry')}</Text>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </View>
          </Pressable>
        </View>
```

with:

```tsx
        <ProfileSectionHeader title={t('profile.villagesEntry')} />
        <VillagesScroll
          villages={villages}
          activeId={activeMunicipalityId}
          joinLabel={t('profile.villagesSection.join')}
          emptyLabel={t('me.villages.empty')}
          badges={{
            active: t('me.villages.activeBadge'),
            admin: t('me.villages.adminBadge'),
            member: t('me.villages.memberBadge'),
          }}
          onPressVillage={(id) => void selectVillage(id)}
          onPressJoin={() => router.push('/discover')}
        />
```

- [ ] **Step 7: Run the profile test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile test -- profile.test`
Expected: PASS (the existing change-photo test + the new membership-loading test).

- [ ] **Step 8: Typecheck and lint the mobile app**

Run: `pnpm --filter cultuvilla-mobile exec tsc --noEmit`
Expected: no errors. (If `Ionicons` becomes unused in `profile.tsx` after the replacement, lint will flag it — remove the now-dead `Ionicons` import if so. `Pressable` is still used by the bio CTA, so keep it.)

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/app/\(tabs\)/profile.tsx apps/mobile/app/\(tabs\)/__tests__/profile.test.tsx
git commit -m "feat(mobile): show pueblo cards + join card on profile screen"
```

---

## Self-Review

**Spec coverage:**
- New `VillagesScroll` component (image-forward cards + AddCard footer, empty branch) → Task 2 ✓
- `EntityCard` `accent` passthrough → Task 2 Step 1 ✓
- Profile wiring: load memberships, replace button, card tap switches active + opens pueblo tab, join → /discover → Task 3 ✓
- i18n reuse + new `profile.villagesSection.join` → Task 1 + used in Task 3 ✓
- `/me/villages` kept, unlinked → satisfied by removing the only `router.push('/me/villages')` in Task 3 ✓
- Tests for VillagesScroll (per-card, active marking, empty, join press) → Task 2 ✓; profile membership-load regression → Task 3 ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code.

**Type consistency:** `VillageRow` shape identical in Task 2 (definition) and Task 3 (`satisfies VillageRow`). `VillagesScrollProps` field names (`activeId`, `joinLabel`, `emptyLabel`, `badges`, `onPressVillage`, `onPressJoin`) match between component definition and profile call site. `getUserMemberships`/`getMunicipality`/`setActiveMunicipality`/`escudoThumbDisplayUrl` import paths verified against existing `me/villages.tsx`.
