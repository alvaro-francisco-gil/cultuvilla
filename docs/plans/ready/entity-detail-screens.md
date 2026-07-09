# Entity detail screens — shared vocabulary + ordago-style header

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Formalize **"entity"** as the umbrella term for village things shown in horizontal scrolls with a detail screen, and migrate all six entity detail screens onto one shared scaffold whose header is a solid static top bar (back + action icons) above a full-bleed flyer — replacing the translucent buttons that currently float over the image.

**Architecture:** Introduce a small stack of presentational components — `HeaderIconButton`, `EntityDetailHeader` (a standalone solid bar), `DetailInfoCard`, and `EntityDetailScaffold` — then rewrite the six detail screens as thin consumers of the scaffold. The four `Floating*` components are deleted at the end.

**Tech Stack:** Expo Router v4, React Native, NativeWind v4, `@cultuvilla/shared` design-system tokens, jest + `@testing-library/react-native`.

## Global Constraints

- **No `firebase/*` imports in screens** — all data via `@cultuvilla/shared/services/*` (unchanged; migrations keep existing service calls).
- **Strict TypeScript, no `any`, no `@ts-nocheck`.**
- **Absolutely-positioned / animated chrome keeps styles on `style`, not `className`** (RN-Web gotcha) — applies to any FAB.
- **Respect `insets.bottom`** for bottom-anchored FABs.
- **i18n:** reuse existing keys only (`header.back`, `deeplink.shareViewLabel`, `common.edit`, `common.notFound`, `event.manageEvent`, `event.editEvent`) — no new strings needed.
- **`pnpm app:test` and `pnpm app:typecheck` must pass.** Never start dev servers.

## Context

The village overview already shares its *display* layer well (`Section` + `BigCard`), and detail screens already share `DetailHeroImage` + a family of `Floating*` buttons. Missing: (1) a formal name for the concept — the code leans on "entity" (`EntityCard`, `useEntityCapabilities`) but never defines it; (2) the header we want — today four translucent discs float over the flyer, we want ordago `TournamentDetails`' solid static bar carrying back + actions.

## Definition — what an "entity" is

An **entity (entidad)** is a village-scoped domain object that (a) appears in a horizontal `Section` scroll as a `BigCard`, and (b) opens a hero-image detail screen. The family:

| Entity | Detail route | Service |
|---|---|---|
| event | `event/[eventId]` | eventService |
| festival-poster (cartel) | `village/[villageId]/festival-poster/[posterId]` | festivalPosterService |
| place (lugar) | `village/[villageId]/place/[placeId]` | municipalityService |
| barrio | `village/[villageId]/barrio/[barrioId]` | municipalityService |
| organization (peña / asociación / ayuntamiento) | `o/[orgId]` | organizationService |
| news | `news/[newsId]` | newsService |

**Not entities:** `person` and `village` — both open into forms and keep their current chrome (`person/[personId]` already uses `ScreenHeader`).

The term is documented in `EntityDetailScaffold`'s doc comment (co-located with the code, per *code is the source of truth*) — **no renames**.

## Decisions (resolved during brainstorming)

- **Layout:** solid static top bar → full-bleed flyer → title / optional info cards / body.
- **Bar behavior:** static (no scroll animation — avoids the RN-Web `Animated`+`className` gotcha).
- **Bar color:** neutral surface (`bg-surface`), dark icons, thin bottom border; status bar `dark`.
- **`EntityDetailHeader` is standalone, not a wrapper over `ScreenHeader`** — the non-accent `ScreenHeader` clamps its right slot to `w-10` (too narrow for 2–3 action icons) and applies no top inset (our bar sits at the very top and must claim `insets.top`).
- **Scope is opportunistic:** ship the scaffold + header now; body content stays per-screen. Only `event` uses `DetailInfoCard` in this pass (it's the one screen with info cards today). No `DetailSection` yet (YAGNI).
- **Share icon:** use `share-outline` uniformly in the bar (drops the old Android-specific `share-social-outline`) — a deliberate minor simplification.

## File Structure

**Create:**
- `apps/mobile/components/feature/HeaderIconButton.tsx` — one bar-sized icon button (Ionicon + a11y label).
- `apps/mobile/components/feature/EntityDetailHeader.tsx` — standalone solid top bar: back on the left, an `actions` list of `HeaderIconButton`s on the right; owns `insets.top` + `StatusBar dark`. Exports the `EntityDetailAction` type.
- `apps/mobile/components/feature/DetailInfoCard.tsx` — event's private `InfoCard` promoted to a shared component.
- `apps/mobile/components/feature/EntityDetailScaffold.tsx` — composes `Screen` + `EntityDetailHeader` + `ScrollView` + `DetailHeroImage` + title + `{children}` + optional `fab` slot; handles `loading` / `notFound`. Carries the "entity" definition in its doc comment.
- Test files colocated under the matching `__tests__/` folders (see tasks).

**Modify:**
- `apps/mobile/components/feature/DetailHeroImage.tsx` — remove the baked-in `FloatingBackButton` and the `showBack`/`onBack` props (the bar owns back now).
- The six detail screens (rewritten as scaffold consumers).

**Delete (final task):**
- `apps/mobile/components/feature/FloatingBackButton.tsx`
- `apps/mobile/components/feature/FloatingShareButton.tsx`
- `apps/mobile/components/feature/FloatingEditButton.tsx`
- `apps/mobile/components/feature/FloatingManageButton.tsx`

**Document + codify the term (per user request):**
- Modify: `AGENTS.md` — add a short `### Entities` convention subsection under `## Conventions`, so the term is authoritative, not just a code comment.
- Create (optional, Task 14): `apps/mobile/lib/entities/registry.ts` — a single source of truth for the `EntityKind` union + the per-kind fallback icon the six screens currently hardcode. The icon map is Ionicons-based (mobile-only), so it lives in `apps/mobile`, not `packages/shared`; promote `EntityKind` to `packages/shared/src/models` only if/when functions or analytics need it.

---

### Task 1: HeaderIconButton

**Files:**
- Create: `apps/mobile/components/feature/HeaderIconButton.tsx`
- Test: `apps/mobile/components/feature/__tests__/HeaderIconButton.test.tsx`

**Interfaces:**
- Produces: `HeaderIconButton({ icon: keyof typeof Ionicons.glyphMap, onPress: () => void, accessibilityLabel: string })`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { HeaderIconButton } from '../HeaderIconButton';

describe('HeaderIconButton', () => {
  it('renders with its accessibility label and fires onPress', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <HeaderIconButton icon="share-outline" onPress={onPress} accessibilityLabel="Compartir" />,
    );
    fireEvent.press(getByLabelText('Compartir'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile exec jest components/feature/__tests__/HeaderIconButton.test.tsx`
Expected: FAIL — cannot find module `../HeaderIconButton`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from '../primitives/Pressable';
import { iconSizes } from '@cultuvilla/shared/design-system';

export type HeaderIconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
};

/** A single action affordance in the EntityDetailHeader bar (dark icon on the
 * neutral surface bar). The neutral-bar analogue of the old floating disc. */
export function HeaderIconButton({ icon, onPress, accessibilityLabel }: HeaderIconButtonProps) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={accessibilityLabel} className="p-1 ml-2">
      <Ionicons name={icon} size={iconSizes.md} color="#0f172a" />
    </Pressable>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile exec jest components/feature/__tests__/HeaderIconButton.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feature/HeaderIconButton.tsx apps/mobile/components/feature/__tests__/HeaderIconButton.test.tsx
git commit -m "feat(mobile): add HeaderIconButton for entity detail bar"
```

---

### Task 2: EntityDetailHeader

**Files:**
- Create: `apps/mobile/components/feature/EntityDetailHeader.tsx`
- Test: `apps/mobile/components/feature/__tests__/EntityDetailHeader.test.tsx`

**Interfaces:**
- Consumes: `HeaderIconButton` (Task 1).
- Produces:
  - `type EntityDetailAction = { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; accessibilityLabel: string }`
  - `EntityDetailHeader({ onBack?: () => void, actions?: EntityDetailAction[] })`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { EntityDetailHeader } from '../EntityDetailHeader';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
const back = jest.fn();
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() } }));

describe('EntityDetailHeader', () => {
  it('renders a back button and one button per action', () => {
    const share = jest.fn();
    const { getByLabelText } = render(
      <EntityDetailHeader
        onBack={back}
        actions={[{ icon: 'share-outline', onPress: share, accessibilityLabel: 'deeplink.shareViewLabel' }]}
      />,
    );
    fireEvent.press(getByLabelText('header.back'));
    expect(back).toHaveBeenCalledTimes(1);
    fireEvent.press(getByLabelText('deeplink.shareViewLabel'));
    expect(share).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile exec jest components/feature/__tests__/EntityDetailHeader.test.tsx`
Expected: FAIL — cannot find module `../EntityDetailHeader`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable } from '../primitives/Pressable';
import { HeaderIconButton } from './HeaderIconButton';
import { iconSizes } from '@cultuvilla/shared/design-system';
import { useT } from '../../lib/i18n';

export type EntityDetailAction = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
};

/**
 * Solid static top bar for entity detail screens: back on the left, an optional
 * list of action icons on the right. Sits at the very top of the screen over
 * the surface background (the flyer starts just below it), so it claims the
 * top safe-area inset itself and drives a dark status bar. Replaces the
 * translucent Floating* discs that used to sit over the hero image.
 */
export function EntityDetailHeader({
  onBack,
  actions = [],
}: {
  onBack?: () => void;
  actions?: EntityDetailAction[];
}) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const handleBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)')));
  return (
    <View className="bg-surface border-b border-subtle" style={{ paddingTop: insets.top }}>
      <StatusBar style="dark" />
      <View className="h-11 flex-row items-center justify-between px-3">
        <Pressable onPress={handleBack} accessibilityLabel={t('header.back')} className="p-1 -ml-1">
          <Ionicons name="chevron-back" size={iconSizes.md} color="#0f172a" />
        </Pressable>
        <View className="flex-row items-center">
          {actions.map((a) => (
            <HeaderIconButton
              key={a.accessibilityLabel}
              icon={a.icon}
              onPress={a.onPress}
              accessibilityLabel={a.accessibilityLabel}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile exec jest components/feature/__tests__/EntityDetailHeader.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feature/EntityDetailHeader.tsx apps/mobile/components/feature/__tests__/EntityDetailHeader.test.tsx
git commit -m "feat(mobile): add EntityDetailHeader solid static bar"
```

---

### Task 3: DetailInfoCard

**Files:**
- Create: `apps/mobile/components/feature/DetailInfoCard.tsx`
- Test: `apps/mobile/components/feature/__tests__/DetailInfoCard.test.tsx`

**Interfaces:**
- Produces: `DetailInfoCard({ icon: keyof typeof Ionicons.glyphMap, label: string, value: string, detail?: string, action: string, onPress: () => void })`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { DetailInfoCard } from '../DetailInfoCard';

describe('DetailInfoCard', () => {
  it('renders label + value and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <DetailInfoCard icon="calendar-outline" label="Fecha" value="12 jul" action="Añadir" onPress={onPress} />,
    );
    getByText('Fecha');
    fireEvent.press(getByText('12 jul'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile exec jest components/feature/__tests__/DetailInfoCard.test.tsx`
Expected: FAIL — cannot find module `../DetailInfoCard`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { VStack } from '../primitives/VStack';
import { HStack } from '../primitives/HStack';
import { Text } from '../primitives/Text';
import { Card } from '../primitives/Card';
import { Pressable } from '../primitives/Pressable';
import { colors, iconSizes } from '@cultuvilla/shared/design-system';

export type DetailInfoCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  detail?: string;
  action: string;
  onPress: () => void;
};

/** A tappable "rectangle" summarising one fact (when / where) with a link out.
 * Promoted from the event detail screen so every entity can share it. */
export function DetailInfoCard({ icon, label, value, detail, action, onPress }: DetailInfoCardProps) {
  return (
    <Pressable onPress={onPress} className="flex-1">
      <Card className="h-full">
        <VStack gap={1}>
          <HStack gap={2} align="center">
            <Ionicons name={icon} size={iconSizes.md} color={colors.light.fg.accent} />
            <Text variant="caption" tone="muted">{label}</Text>
          </HStack>
          <Text variant="h3" numberOfLines={2}>{value}</Text>
          {detail ? <Text tone="muted">{detail}</Text> : null}
          <Text variant="caption" className="text-accent">{`${action} →`}</Text>
        </VStack>
      </Card>
    </Pressable>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile exec jest components/feature/__tests__/DetailInfoCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feature/DetailInfoCard.tsx apps/mobile/components/feature/__tests__/DetailInfoCard.test.tsx
git commit -m "feat(mobile): promote event InfoCard to shared DetailInfoCard"
```

---

### Task 4: Strip the baked-in back button from DetailHeroImage

**Files:**
- Modify: `apps/mobile/components/feature/DetailHeroImage.tsx`

**Interfaces:**
- Produces: `DetailHeroImage({ imageUri: string | null, fallbackImageUri?: string | null, fallbackIcon: keyof typeof Ionicons.glyphMap })` — the `showBack` and `onBack` props are removed.

- [ ] **Step 1: Rewrite the component without the floating back button**

Replace the entire file with:

```tsx
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NaturalImage } from '../primitives/NaturalImage';

/**
 * Full-bleed hero image ("flyer") shown directly below the EntityDetailHeader
 * on every entity detail screen. Follows the FeedCard image chain: the item's
 * own image → the village cover photo (`fallbackImageUri`) → a tinted
 * placeholder with `fallbackIcon`. A real photo is shown at its natural aspect
 * ratio (never cropped); only the placeholder uses the fixed 4:3 box. Back /
 * share / edit affordances live in the header bar above, not on this image.
 */

// Width:height for the placeholder fallback (matches FeedCard's card image).
const ASPECT_RATIO = 4 / 3;
const PLACEHOLDER_BG = '#dcab93'; // palette.peach

export type DetailHeroImageProps = {
  imageUri: string | null;
  fallbackImageUri?: string | null;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
};

export function DetailHeroImage({
  imageUri,
  fallbackImageUri = null,
  fallbackIcon,
}: DetailHeroImageProps) {
  const displayUri = imageUri ?? fallbackImageUri;
  return (
    <View style={{ width: '100%' }}>
      {displayUri ? (
        <NaturalImage uri={displayUri} initialAspectRatio={ASPECT_RATIO} />
      ) : (
        <View
          className="items-center justify-center"
          style={{ width: '100%', aspectRatio: ASPECT_RATIO, backgroundColor: PLACEHOLDER_BG }}
        >
          <Ionicons name={fallbackIcon} size={72} color="#ffffff" />
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck (expect errors at old call sites)**

Run: `pnpm app:typecheck`
Expected: FAIL — the six detail screens still import `FloatingBackButton` and pass removed props; these are fixed in Tasks 6–11. (This task's own file is correct.)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/feature/DetailHeroImage.tsx
git commit -m "refactor(mobile): drop baked-in back button from DetailHeroImage"
```

---

### Task 5: EntityDetailScaffold

**Files:**
- Create: `apps/mobile/components/feature/EntityDetailScaffold.tsx`
- Test: `apps/mobile/components/feature/__tests__/EntityDetailScaffold.test.tsx`

**Interfaces:**
- Consumes: `EntityDetailHeader` + `EntityDetailAction` (Task 2), `DetailHeroImage` (Task 4).
- Produces:
  ```ts
  EntityDetailScaffold({
    loading: boolean;
    notFound?: boolean;
    imageUri: string | null;
    fallbackImageUri?: string | null;
    fallbackIcon: keyof typeof Ionicons.glyphMap;
    onBack?: () => void;
    actions?: EntityDetailAction[];
    title?: string;
    children?: ReactNode;
    fab?: ReactNode;
    scrollContentClassName?: string;
  })
  ```

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { EntityDetailScaffold } from '../EntityDetailScaffold';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() } }));

describe('EntityDetailScaffold', () => {
  it('shows a spinner while loading and the title + body once loaded', () => {
    const { rerender, queryByText, getByText } = render(
      <EntityDetailScaffold loading imageUri={null} fallbackIcon="image-outline" title="Fiestas" />,
    );
    expect(queryByText('Fiestas')).toBeNull();

    rerender(
      <EntityDetailScaffold loading={false} imageUri={null} fallbackIcon="image-outline" title="Fiestas">
        <Text>cuerpo</Text>
      </EntityDetailScaffold>,
    );
    getByText('Fiestas');
    getByText('cuerpo');
  });

  it('renders the not-found state', () => {
    const { getByText } = render(
      <EntityDetailScaffold loading={false} notFound imageUri={null} fallbackIcon="image-outline" />,
    );
    getByText('common.notFound');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile exec jest components/feature/__tests__/EntityDetailScaffold.test.tsx`
Expected: FAIL — cannot find module `../EntityDetailScaffold`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../primitives/Screen';
import { VStack } from '../primitives/VStack';
import { Text } from '../primitives/Text';
import { DetailHeroImage } from './DetailHeroImage';
import { EntityDetailHeader, type EntityDetailAction } from './EntityDetailHeader';
import { useT } from '../../lib/i18n';

/**
 * Shared scaffold for every ENTITY detail screen. An "entity" is a
 * village-scoped object shown in a horizontal Section scroll (as a BigCard)
 * that opens a hero-image detail screen: event, festival-poster (cartel),
 * place, barrio, organization, news. (person + village are NOT entities — they
 * open into forms.) The scaffold owns the chrome — solid static header bar,
 * full-bleed flyer, title, and loading / not-found states — so each screen is
 * a thin body: fetch data, pass `actions`, render `{children}` and an optional
 * `fab`.
 */
export type EntityDetailScaffoldProps = {
  loading: boolean;
  notFound?: boolean;
  imageUri: string | null;
  fallbackImageUri?: string | null;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
  onBack?: () => void;
  actions?: EntityDetailAction[];
  title?: string;
  children?: ReactNode;
  /** Absolutely-positioned bottom affordance (register / join). Styles must
   * live on `style`, not `className`, to render on RN-Web. */
  fab?: ReactNode;
  scrollContentClassName?: string;
};

export function EntityDetailScaffold({
  loading,
  notFound = false,
  imageUri,
  fallbackImageUri = null,
  fallbackIcon,
  onBack,
  actions = [],
  title,
  children,
  fab,
  scrollContentClassName = 'pb-10',
}: EntityDetailScaffoldProps) {
  const { t } = useT();
  const busy = loading || notFound;
  return (
    <Screen padded={false} topInset={false}>
      <EntityDetailHeader onBack={onBack} actions={busy ? [] : actions} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : notFound ? (
        <View className="flex-1 items-center justify-center">
          <Text>{t('common.notFound')}</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerClassName={scrollContentClassName}>
            <DetailHeroImage
              imageUri={imageUri}
              fallbackImageUri={fallbackImageUri}
              fallbackIcon={fallbackIcon}
            />
            <VStack gap={3} className="p-4">
              {title ? <Text variant="h1">{title}</Text> : null}
              {children}
            </VStack>
          </ScrollView>
          {fab}
        </>
      )}
    </Screen>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile exec jest components/feature/__tests__/EntityDetailScaffold.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feature/EntityDetailScaffold.tsx apps/mobile/components/feature/__tests__/EntityDetailScaffold.test.tsx
git commit -m "feat(mobile): add EntityDetailScaffold + formalize 'entity' term"
```

---

### Task 6: Migrate the festival-poster detail screen

**Files:**
- Modify: `apps/mobile/app/village/[villageId]/festival-poster/[posterId].tsx`
- Test: `apps/mobile/app/village/[villageId]/festival-poster/__tests__/posterId.test.tsx`

**Interfaces:**
- Consumes: `EntityDetailScaffold` (Task 5).

- [ ] **Step 1: Rewrite the screen**

Replace the entire file with:

```tsx
import { useCallback, useState } from 'react';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Text } from '../../../../components/primitives/Text';
import { EntityDetailScaffold } from '../../../../components/feature/EntityDetailScaffold';
import { getFestivalPoster } from '@cultuvilla/shared/services/festivalPosterService';
import type { FestivalPosterWithId } from '@cultuvilla/shared/services/festivalPosterService';
import { formatFestivalPosterDates } from '@cultuvilla/shared/utils';

export default function FestivalPosterDetailScreen() {
  const { posterId } = useLocalSearchParams<{ villageId: string; posterId: string }>();
  const [poster, setPoster] = useState<FestivalPosterWithId | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!posterId) return;
    try {
      setPoster(await getFestivalPoster(posterId));
    } finally {
      setLoading(false);
    }
  }, [posterId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const dateLabel = poster ? formatFestivalPosterDates(poster) : '';
  const subtitle = poster
    ? [poster.title ? String(poster.year) : null, dateLabel].filter(Boolean).join(' · ')
    : '';

  return (
    <EntityDetailScaffold
      loading={loading}
      notFound={!loading && !poster}
      imageUri={poster?.imageURL ?? null}
      fallbackIcon="image-outline"
      title={poster ? (poster.title ?? String(poster.year)) : undefined}
    >
      {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
    </EntityDetailScaffold>
  );
}
```

- [ ] **Step 2: Write the smoke test**

```tsx
import { render, waitFor } from '@testing-library/react-native';
import FestivalPosterDetailScreen from '../[posterId]';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1', posterId: 'p1' }),
  useFocusEffect: (cb: () => void) => cb(),
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('../../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('@cultuvilla/shared/services/festivalPosterService', () => ({
  getFestivalPoster: jest.fn().mockResolvedValue({ id: 'p1', title: 'Fiestas 2026', year: 2026, imageURL: null, startDate: null, endDate: null }),
}));
jest.mock('@cultuvilla/shared/utils', () => ({ formatFestivalPosterDates: () => 'del 1 al 5' }));

describe('FestivalPosterDetailScreen', () => {
  it('renders the poster title once loaded', async () => {
    const { getByText } = render(<FestivalPosterDetailScreen />);
    await waitFor(() => getByText('Fiestas 2026'));
  });
});
```

- [ ] **Step 3: Run the test**

Run: `pnpm --filter cultuvilla-mobile exec jest app/village/\[villageId\]/festival-poster`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/village/\[villageId\]/festival-poster/
git commit -m "refactor(mobile): festival-poster detail onto EntityDetailScaffold"
```

---

### Task 7: Migrate the place detail screen

**Files:**
- Modify: `apps/mobile/app/village/[villageId]/place/[placeId].tsx`
- Test: `apps/mobile/app/village/[villageId]/place/__tests__/placeId.test.tsx`

**Interfaces:**
- Consumes: `EntityDetailScaffold` + `EntityDetailAction` (Tasks 2, 5).

- [ ] **Step 1: Rewrite the screen**

Replace the entire file with:

```tsx
import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Text } from '../../../../components/primitives/Text';
import { VStack } from '../../../../components/primitives/VStack';
import { EntityDetailScaffold } from '../../../../components/feature/EntityDetailScaffold';
import type { EntityDetailAction } from '../../../../components/feature/EntityDetailHeader';
import { PersonCard } from '../../../../components/feature/VillageSections';
import { useT } from '../../../../lib/i18n';
import { useShareDeepLink } from '../../../../lib/deeplink/useShareDeepLink';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';
import { getPlace } from '@cultuvilla/shared/services/municipalityService';
import { getPlaceViewLink } from '@cultuvilla/shared/services/deepLinkService';
import { getPersonsByBurialPlace } from '@cultuvilla/shared/services/personService';
import { buildDisplayName } from '@cultuvilla/shared/models/person';
import type { PlaceData } from '@cultuvilla/shared/models/municipality';
import type { PersonData } from '@cultuvilla/shared/models/person';

type Place = PlaceData & { id: string };
type Person = PersonData & { id: string };

export default function PlaceDetailScreen() {
  const { villageId, placeId } = useLocalSearchParams<{ villageId: string; placeId: string }>();
  const { t } = useT();
  const share = useShareDeepLink();
  const [place, setPlace] = useState<Place | null>(null);
  const [buried, setBuried] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const { canManage } = useEntityCapabilities(villageId);

  const load = useCallback(async () => {
    if (!villageId || !placeId) return;
    try {
      const p = await getPlace(villageId, placeId);
      setPlace(p);
      if (p?.kind === 'cemetery') {
        setBuried(await getPersonsByBurialPlace(placeId));
      }
    } finally {
      setLoading(false);
    }
  }, [villageId, placeId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const actions: EntityDetailAction[] = place
    ? [
        {
          icon: 'share-outline',
          accessibilityLabel: t('deeplink.shareViewLabel'),
          onPress: () => void share(getPlaceViewLink(villageId, place.id), place.name),
        },
        ...(canManage
          ? [
              {
                icon: 'create-outline' as const,
                accessibilityLabel: t('common.edit'),
                onPress: () => router.push(`/village/${villageId}/place/${place.id}/edit` as never),
              },
            ]
          : []),
      ]
    : [];

  return (
    <EntityDetailScaffold
      loading={loading}
      notFound={!loading && !place}
      imageUri={place?.imageURL ?? null}
      fallbackIcon="location-outline"
      actions={actions}
      title={place?.name}
    >
      {place ? (
        <>
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
        </>
      ) : null}
    </EntityDetailScaffold>
  );
}
```

- [ ] **Step 2: Write the smoke test**

```tsx
import { render, waitFor } from '@testing-library/react-native';
import PlaceDetailScreen from '../[placeId]';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1', placeId: 'pl1' }),
  useFocusEffect: (cb: () => void) => cb(),
  router: { back: jest.fn(), push: jest.fn(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('../../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../../../lib/deeplink/useShareDeepLink', () => ({ useShareDeepLink: () => jest.fn() }));
jest.mock('../../../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: () => ({ canManage: false, uid: 'u1', loading: false }),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getPlace: jest.fn().mockResolvedValue({ id: 'pl1', name: 'La Plaza', kind: 'square', imageURL: null, description: 'desc' }),
}));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({ getPlaceViewLink: () => 'https://x' }));
jest.mock('@cultuvilla/shared/services/personService', () => ({ getPersonsByBurialPlace: jest.fn().mockResolvedValue([]) }));
jest.mock('@cultuvilla/shared/models/person', () => ({ buildDisplayName: () => 'N' }));

describe('PlaceDetailScreen', () => {
  it('renders the place name and a share action', async () => {
    const { getByText, getByLabelText } = render(<PlaceDetailScreen />);
    await waitFor(() => getByText('La Plaza'));
    getByLabelText('deeplink.shareViewLabel');
  });
});
```

- [ ] **Step 3: Run the test**

Run: `pnpm --filter cultuvilla-mobile exec jest app/village/\[villageId\]/place`
Expected: PASS (the existing `edit.test.tsx` in this folder must also stay green).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/village/\[villageId\]/place/
git commit -m "refactor(mobile): place detail onto EntityDetailScaffold"
```

---

### Task 8: Migrate the barrio detail screen

**Files:**
- Modify: `apps/mobile/app/village/[villageId]/barrio/[barrioId].tsx`
- Test: `apps/mobile/app/village/[villageId]/barrio/__tests__/barrioId.test.tsx`

**Interfaces:**
- Consumes: `EntityDetailScaffold` + `EntityDetailAction`.

- [ ] **Step 1: Rewrite the screen**

Replace the entire file with:

```tsx
import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Text } from '../../../../components/primitives/Text';
import { VStack } from '../../../../components/primitives/VStack';
import { EntityDetailScaffold } from '../../../../components/feature/EntityDetailScaffold';
import type { EntityDetailAction } from '../../../../components/feature/EntityDetailHeader';
import { PersonCard } from '../../../../components/feature/VillageSections';
import { useT } from '../../../../lib/i18n';
import { useShareDeepLink } from '../../../../lib/deeplink/useShareDeepLink';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';
import { getBarrio } from '@cultuvilla/shared/services/municipalityService';
import { getBarrioViewLink } from '@cultuvilla/shared/services/deepLinkService';
import { getPersonsByBarrio } from '@cultuvilla/shared/services/personService';
import { buildDisplayName } from '@cultuvilla/shared/models/person';
import type { BarrioData } from '@cultuvilla/shared/models/municipality';
import type { PersonData } from '@cultuvilla/shared/models/person';

type Barrio = BarrioData & { id: string };
type Person = PersonData & { id: string };

export default function BarrioDetailScreen() {
  const { villageId, barrioId } = useLocalSearchParams<{ villageId: string; barrioId: string }>();
  const { t } = useT();
  const share = useShareDeepLink();
  const { canManage } = useEntityCapabilities(villageId);
  const [barrio, setBarrio] = useState<Barrio | null>(null);
  const [residents, setResidents] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!villageId || !barrioId) return;
    try {
      const [b, people] = await Promise.all([
        getBarrio(villageId, barrioId),
        getPersonsByBarrio(villageId, barrioId),
      ]);
      setBarrio(b);
      setResidents(people);
    } finally {
      setLoading(false);
    }
  }, [villageId, barrioId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const actions: EntityDetailAction[] = barrio
    ? [
        {
          icon: 'share-outline',
          accessibilityLabel: t('deeplink.shareViewLabel'),
          onPress: () => void share(getBarrioViewLink(villageId, barrio.id), barrio.name),
        },
        ...(canManage
          ? [
              {
                icon: 'create-outline' as const,
                accessibilityLabel: t('common.edit'),
                onPress: () => router.push(`/village/${villageId}/barrio/${barrio.id}/edit` as never),
              },
            ]
          : []),
      ]
    : [];

  return (
    <EntityDetailScaffold
      loading={loading}
      notFound={!loading && !barrio}
      imageUri={barrio?.imageURL ?? null}
      fallbackIcon="map-outline"
      actions={actions}
      title={barrio?.name}
    >
      {barrio ? (
        <>
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
        </>
      ) : null}
    </EntityDetailScaffold>
  );
}
```

- [ ] **Step 2: Write the smoke test**

```tsx
import { render, waitFor } from '@testing-library/react-native';
import BarrioDetailScreen from '../[barrioId]';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1', barrioId: 'b1' }),
  useFocusEffect: (cb: () => void) => cb(),
  router: { back: jest.fn(), push: jest.fn(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('../../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../../../lib/deeplink/useShareDeepLink', () => ({ useShareDeepLink: () => jest.fn() }));
jest.mock('../../../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: () => ({ canManage: false, uid: 'u1', loading: false }),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getBarrio: jest.fn().mockResolvedValue({ id: 'b1', name: 'Centro', imageURL: null, municipalityId: 'm1' }),
}));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({ getBarrioViewLink: () => 'https://x' }));
jest.mock('@cultuvilla/shared/services/personService', () => ({ getPersonsByBarrio: jest.fn().mockResolvedValue([]) }));
jest.mock('@cultuvilla/shared/models/person', () => ({ buildDisplayName: () => 'N' }));

describe('BarrioDetailScreen', () => {
  it('renders the barrio name once loaded', async () => {
    const { getByText } = render(<BarrioDetailScreen />);
    await waitFor(() => getByText('Centro'));
  });
});
```

- [ ] **Step 3: Run the test**

Run: `pnpm --filter cultuvilla-mobile exec jest app/village/\[villageId\]/barrio`
Expected: PASS (existing `edit.test.tsx` stays green).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/village/\[villageId\]/barrio/
git commit -m "refactor(mobile): barrio detail onto EntityDetailScaffold"
```

---

### Task 9: Migrate the organization detail screen

**Files:**
- Modify: `apps/mobile/app/o/[orgId]/index.tsx`
- Test: `apps/mobile/app/o/__tests__/index.test.tsx`

**Interfaces:**
- Consumes: `EntityDetailScaffold` + `EntityDetailAction`.

- [ ] **Step 1: Rewrite the screen**

Replace the entire file with (the join pill is passed via the scaffold's `fab` slot; its styles stay on `style`):

```tsx
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Text } from '../../../components/primitives/Text';
import { EntityDetailScaffold } from '../../../components/feature/EntityDetailScaffold';
import type { EntityDetailAction } from '../../../components/feature/EntityDetailHeader';
import { useT } from '../../../lib/i18n';
import { useAuth } from '../../../lib/auth/useAuth';
import { useRegisterGate } from '../../../lib/auth/RegisterGateContext';
import { useOrgCapabilities } from '../../../lib/auth/useOrgCapabilities';
import { useShareDeepLink } from '../../../lib/deeplink/useShareDeepLink';
import { getOrganization } from '@cultuvilla/shared/services/organizationService';
import { isOrgMember, addOrgMember, getOrgMembers } from '@cultuvilla/shared/services/orgMemberService';
import { getOrgViewLink } from '@cultuvilla/shared/services/deepLinkService';
import type { OrganizationData } from '@cultuvilla/shared/models/organization/OrganizationDataModel';

type Org = OrganizationData & { id: string };

export default function OrgDetailScreen() {
  const { orgId, intent } = useLocalSearchParams<{ orgId: string; intent?: string }>();
  const arrivedViaInvite = intent === 'join';
  const { t } = useT();
  const { user } = useAuth();
  const gate = useRegisterGate();
  const share = useShareDeepLink();
  const insets = useSafeAreaInsets();
  const [org, setOrg] = useState<Org | null>(null);
  const [membersCount, setMembersCount] = useState<number | null>(null);
  const [isMember, setIsMember] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const { canManage } = useOrgCapabilities(orgId as string, org?.municipalityId);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    const o = await getOrganization(orgId as string);
    setOrg(o);
    const members = await getOrgMembers(orgId as string);
    setMembersCount(members.length);
    if (user) setIsMember(await isOrgMember(orgId as string, user.uid));
    setLoading(false);
  }, [orgId, user]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onJoin = useCallback(async () => {
    if (!user) {
      gate.requireAuth(`/o/${orgId}`, t('guest.org'));
      return;
    }
    if (!orgId) return;
    setJoining(true);
    try {
      await addOrgMember(orgId as string, user.uid);
      await refresh();
    } finally {
      setJoining(false);
    }
  }, [user, orgId, refresh, gate, t]);

  const actions: EntityDetailAction[] = org
    ? [
        {
          icon: 'share-outline',
          accessibilityLabel: t('deeplink.shareViewLabel'),
          onPress: () => void share(getOrgViewLink(org.id), org.name),
        },
        ...(canManage
          ? [
              {
                icon: 'create-outline' as const,
                accessibilityLabel: t('common.edit'),
                onPress: () => router.push(`/o/${org.id}/edit` as never),
              },
            ]
          : []),
      ]
    : [];

  return (
    <EntityDetailScaffold
      loading={loading}
      notFound={!loading && !org}
      imageUri={org?.imageURL ?? null}
      fallbackIcon="people-outline"
      actions={actions}
      title={org?.name}
      scrollContentClassName="pb-28"
      fab={
        org && !isMember ? (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 24, alignItems: 'center', zIndex: 20 }}
          >
            <Pressable
              onPress={onJoin}
              disabled={joining}
              testID="join-org-fab"
              accessibilityRole="button"
              accessibilityState={{ disabled: joining }}
              accessibilityLabel={user ? t('organization.join') : t('organization.signInToJoin')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
                paddingHorizontal: 22,
                borderRadius: 999,
                backgroundColor: '#bb5d3a',
                opacity: joining ? 0.7 : 1,
                elevation: 6,
                shadowColor: '#000',
                shadowOpacity: 0.25,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 },
              }}
            >
              {joining ? (
                <ActivityIndicator color="#f9f0e8" style={{ marginRight: 8 }} />
              ) : (
                <RNText style={{ color: '#f9f0e8', fontSize: 18, lineHeight: 22, marginRight: 8 }}>+</RNText>
              )}
              <RNText style={{ color: '#f9f0e8', fontSize: 16, fontWeight: '700' }}>
                {user ? t('organization.join') : t('organization.signInToJoin')}
              </RNText>
            </Pressable>
          </View>
        ) : null
      }
    >
      {org ? (
        <>
          {org.description ? <Text>{org.description}</Text> : null}
          <Text tone="muted">{t('organization.membersCount', { count: membersCount ?? 0 })}</Text>
          {arrivedViaInvite && !isMember ? (
            <Text tone="muted" variant="bodySm">
              {t('organization.invitedBanner')}
            </Text>
          ) : null}
        </>
      ) : null}
    </EntityDetailScaffold>
  );
}
```

- [ ] **Step 2: Write the smoke test**

```tsx
import { render, waitFor } from '@testing-library/react-native';
import OrgDetailScreen from '../[orgId]/index';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ orgId: 'o1' }),
  useFocusEffect: (cb: () => void) => cb(),
  router: { back: jest.fn(), push: jest.fn(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../lib/auth/useAuth', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../../../lib/auth/RegisterGateContext', () => ({ useRegisterGate: () => ({ requireAuth: jest.fn() }) }));
jest.mock('../../../lib/auth/useOrgCapabilities', () => ({ useOrgCapabilities: () => ({ canManage: false }) }));
jest.mock('../../../lib/deeplink/useShareDeepLink', () => ({ useShareDeepLink: () => jest.fn() }));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getOrganization: jest.fn().mockResolvedValue({ id: 'o1', name: 'Peña La Unión', imageURL: null, description: 'd', municipalityId: 'm1' }),
}));
jest.mock('@cultuvilla/shared/services/orgMemberService', () => ({
  isOrgMember: jest.fn().mockResolvedValue(false),
  addOrgMember: jest.fn(),
  getOrgMembers: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({ getOrgViewLink: () => 'https://x' }));

describe('OrgDetailScreen', () => {
  it('renders the org name and the join FAB for a guest', async () => {
    const { getByText, getByTestId } = render(<OrgDetailScreen />);
    await waitFor(() => getByText('Peña La Unión'));
    getByTestId('join-org-fab');
  });
});
```

- [ ] **Step 3: Run the test**

Run: `pnpm --filter cultuvilla-mobile exec jest app/o`
Expected: PASS (existing `o/__tests__/edit.test.tsx` stays green).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/o/
git commit -m "refactor(mobile): org detail onto EntityDetailScaffold"
```

---

### Task 10: Migrate the news detail screen

**Files:**
- Modify: `apps/mobile/app/news/[newsId].tsx`
- Test: `apps/mobile/app/news/__tests__/newsId.test.tsx`

**Interfaces:**
- Consumes: `EntityDetailScaffold` + `EntityDetailAction`.

- [ ] **Step 1: Rewrite the screen**

Replace the entire file with:

```tsx
import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Text } from '../../components/primitives/Text';
import { HStack } from '../../components/primitives/HStack';
import { EntityDetailScaffold } from '../../components/feature/EntityDetailScaffold';
import type { EntityDetailAction } from '../../components/feature/EntityDetailHeader';
import { NewsContentRenderer } from '../../components/feature/NewsContentRenderer';
import { LiveOwnerChip } from '../../components/feature/LiveOwnerChip';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { useShareDeepLink } from '../../lib/deeplink/useShareDeepLink';
import { getNewsLink } from '@cultuvilla/shared/services/deepLinkService';
import { getNewsPost } from '@cultuvilla/shared/services/newsService';
import { newsImageDownloadURL } from '@cultuvilla/shared/services/imageService';
import { formatDate } from '@cultuvilla/shared/utils';
import type { NewsPostData } from '@cultuvilla/shared/models/news/NewsPostDataModel';

type Post = NewsPostData & { id: string };

export default function NewsDetailScreen() {
  const { newsId } = useLocalSearchParams<{ newsId: string }>();
  const { t } = useT();
  const { user } = useAuth();
  const share = useShareDeepLink();
  const [post, setPost] = useState<Post | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!newsId) return;
    getNewsPost(newsId as string)
      .then((p) => setPost(p))
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [newsId]);

  const firstImagePath = post?.coverImage?.storagePath ?? post?.images[0]?.storagePath ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!firstImagePath) {
      setImageUrl(null);
      return;
    }
    newsImageDownloadURL(firstImagePath)
      .then((url) => {
        if (!cancelled) setImageUrl(url);
      })
      .catch(() => {
        if (!cancelled) setImageUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [firstImagePath]);

  const date = post ? (post.publishedAt ?? post.submittedAt) : null;
  const canEdit =
    !!user && !!post && (post.createdBy === user.uid || post.organizerUserIds.includes(user.uid));

  const actions: EntityDetailAction[] = post
    ? [
        {
          icon: 'share-outline',
          accessibilityLabel: t('deeplink.shareViewLabel'),
          onPress: () => void share(getNewsLink(post.id), post.title),
        },
        ...(canEdit
          ? [
              {
                icon: 'create-outline' as const,
                accessibilityLabel: t('news.compose.editTitle'),
                onPress: () => router.push(`/news/new?newsId=${post.id}` as never),
              },
            ]
          : []),
      ]
    : [];

  return (
    <EntityDetailScaffold
      loading={loading}
      notFound={!loading && !post}
      imageUri={imageUrl}
      fallbackIcon="newspaper-outline"
      actions={actions}
      title={post?.title}
    >
      {post ? (
        <>
          {post.organizerOrgIds.map((id) => (
            <LiveOwnerChip key={id} ownerId={id} ownerType="organization" size={28} tone="muted" />
          ))}
          {post.organizerUserIds.map((id) => (
            <LiveOwnerChip key={id} ownerId={id} ownerType="user" size={28} tone="muted" />
          ))}
          <HStack gap={2} justify="between">
            <Text tone="muted">{t(`news.compose.category.${post.category}`)}</Text>
            {date ? <Text tone="muted">{formatDate(date, 'long')}</Text> : null}
          </HStack>
          <NewsContentRenderer content={post.content} body={post.body} municipalityId={post.municipalityId} />
        </>
      ) : null}
    </EntityDetailScaffold>
  );
}
```

- [ ] **Step 2: Write the smoke test**

```tsx
import { render, waitFor } from '@testing-library/react-native';
import NewsDetailScreen from '../[newsId]';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ newsId: 'n1' }),
  router: { back: jest.fn(), push: jest.fn(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../lib/auth/useAuth', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../../../lib/deeplink/useShareDeepLink', () => ({ useShareDeepLink: () => jest.fn() }));
jest.mock('../../../components/feature/NewsContentRenderer', () => ({ NewsContentRenderer: () => null }));
jest.mock('../../../components/feature/LiveOwnerChip', () => ({ LiveOwnerChip: () => null }));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({ getNewsLink: () => 'https://x' }));
jest.mock('@cultuvilla/shared/services/newsService', () => ({
  getNewsPost: jest.fn().mockResolvedValue({
    id: 'n1', title: 'Gran noticia', category: 'general', municipalityId: 'm1',
    images: [], coverImage: null, content: null, body: '', organizerOrgIds: [], organizerUserIds: [],
    createdBy: 'u9', publishedAt: null, submittedAt: null,
  }),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({ newsImageDownloadURL: jest.fn() }));
jest.mock('@cultuvilla/shared/utils', () => ({ formatDate: () => '' }));

describe('NewsDetailScreen', () => {
  it('renders the post title once loaded', async () => {
    const { getByText } = render(<NewsDetailScreen />);
    await waitFor(() => getByText('Gran noticia'));
  });
});
```

- [ ] **Step 3: Run the test**

Run: `pnpm --filter cultuvilla-mobile exec jest app/news`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/news/
git commit -m "refactor(mobile): news detail onto EntityDetailScaffold"
```

---

### Task 11: Migrate the event detail screen

**Files:**
- Modify: `apps/mobile/app/event/[eventId].tsx`
- Test: `apps/mobile/app/event/__tests__/eventId.test.tsx`

**Interfaces:**
- Consumes: `EntityDetailScaffold` + `EntityDetailAction` (Tasks 2, 5), `DetailInfoCard` (Task 3).

- [ ] **Step 1: Rewrite the screen**

Replace the entire file with (note: the private `InfoCard` is gone — it now imports `DetailInfoCard`; `RegisterFab` goes in the `fab` slot; the guest CTA + "needs person" text stay in `{children}`):

```tsx
import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Linking } from 'react-native';
import { VStack } from '../../components/primitives/VStack';
import { HStack } from '../../components/primitives/HStack';
import { Text } from '../../components/primitives/Text';
import { Button } from '../../components/primitives/Button';
import { LiveOwnerChip } from '../../components/feature/LiveOwnerChip';
import { RegisterFab } from '../../components/feature/RegisterFab';
import { useEventOrganizer } from '../../lib/events/useEventOrganizer';
import { EntityDetailScaffold } from '../../components/feature/EntityDetailScaffold';
import type { EntityDetailAction } from '../../components/feature/EntityDetailHeader';
import { DetailInfoCard } from '../../components/feature/DetailInfoCard';
import { useAuth } from '../../lib/auth/useAuth';
import { useRegisterGate } from '../../lib/auth/RegisterGateContext';
import { useShareDeepLink } from '../../lib/deeplink/useShareDeepLink';
import { getEvent } from '@cultuvilla/shared/services/eventService';
import { getEventLink } from '@cultuvilla/shared/services/deepLinkService';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { buildDisplayName } from '@cultuvilla/shared/models/person/PersonDataModel';
import { formatDate, buildGoogleCalendarUrl } from '@cultuvilla/shared/utils';
import { useT } from '../../lib/i18n';
import type { EventData } from '@cultuvilla/shared/models/event/EventDataModel';
import type { PersonData } from '@cultuvilla/shared/models/person/PersonDataModel';

type EventDoc = EventData & { id: string };
type PersonDoc = PersonData & { id: string };

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuth();
  const gate = useRegisterGate();
  const { t } = useT();
  const share = useShareDeepLink();
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [person, setPerson] = useState<PersonDoc | null>(null);
  const { canOrganize } = useEventOrganizer(event);

  useEffect(() => {
    if (!eventId) return;
    void (async () => {
      setEvent(await getEvent(eventId));
    })();
  }, [eventId]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setPerson(await getPersonByUserId(user.uid));
    })();
  }, [user]);

  const personName = person ? buildDisplayName(person) : '';

  const openInMaps = () => {
    const c = event?.location?.coordinates;
    if (!c) return;
    void Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`,
    ).catch(() => {});
  };

  const addToCalendar = () => {
    if (!event) return;
    void Linking.openURL(
      buildGoogleCalendarUrl({
        title: event.title,
        start: event.startDate,
        end: event.endDate,
        details: event.description,
        location: event.location?.displayName,
      }),
    ).catch(() => {});
  };

  const actions: EntityDetailAction[] = event
    ? [
        ...(canOrganize
          ? [
              {
                icon: 'people-outline' as const,
                accessibilityLabel: t('event.manageEvent'),
                onPress: () => router.push(`/event/${event.id}/organize` as never),
              },
              {
                icon: 'create-outline' as const,
                accessibilityLabel: t('event.editEvent'),
                onPress: () => router.push(`/event/new?eventId=${event.id}` as never),
              },
            ]
          : []),
        {
          icon: 'share-outline',
          accessibilityLabel: t('deeplink.shareViewLabel'),
          onPress: () => void share(getEventLink(event.id), event.title),
        },
      ]
    : [];

  return (
    <EntityDetailScaffold
      loading={!event}
      imageUri={event?.imageURL ?? null}
      fallbackImageUri={event?.villageCoverImage ?? null}
      fallbackIcon="calendar-outline"
      actions={actions}
      title={event?.title}
      scrollContentClassName="pb-24"
      fab={
        event && person && user ? (
          <RegisterFab
            eventId={event.id}
            userId={user.uid}
            personId={person.id}
            name={personName}
            telephoneRequired={!!event.telephoneRequired}
          />
        ) : null
      }
    >
      {event ? (
        <>
          <HStack gap={3} align="stretch">
            <DetailInfoCard
              icon="calendar-outline"
              label={t('event.dateTime')}
              value={formatDate(event.startDate, 'dayMonth')}
              detail={formatDate(event.startDate, 'time')}
              action={t('event.addToCalendar')}
              onPress={addToCalendar}
            />
            {event.location ? (
              <DetailInfoCard
                icon="location-outline"
                label={t('event.location')}
                value={event.location.displayName}
                action={t('event.locationPin')}
                onPress={openInMaps}
              />
            ) : null}
          </HStack>
          {(event.organizerUserIds?.length > 0 || event.organizerOrgIds?.length > 0) && (
            <VStack gap={2}>
              <Text tone="muted">{t('event.organizersLabel')}</Text>
              {event.organizerOrgIds?.map((id) => (
                <LiveOwnerChip key={id} ownerType="organization" ownerId={id} />
              ))}
              {event.organizerUserIds?.map((id) => (
                <LiveOwnerChip key={id} ownerType="user" ownerId={id} />
              ))}
            </VStack>
          )}
          {event.description ? <Text>{event.description}</Text> : null}
          {!user && (
            <Button variant="primary" fullWidth onPress={() => gate.requireAuth(`/event/${event.id}`, t('guest.event'))}>
              {t('guest.eventCta')}
            </Button>
          )}
          {!person && user ? <Text tone="muted">{t('event.register.needsPerson')}</Text> : null}
        </>
      ) : null}
    </EntityDetailScaffold>
  );
}
```

- [ ] **Step 2: Write the smoke test**

```tsx
import { render, waitFor } from '@testing-library/react-native';
import EventDetailScreen from '../[eventId]';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ eventId: 'e1' }),
  router: { back: jest.fn(), push: jest.fn(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../lib/auth/useAuth', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../../../lib/auth/RegisterGateContext', () => ({ useRegisterGate: () => ({ requireAuth: jest.fn() }) }));
jest.mock('../../../lib/deeplink/useShareDeepLink', () => ({ useShareDeepLink: () => jest.fn() }));
jest.mock('../../../lib/events/useEventOrganizer', () => ({ useEventOrganizer: () => ({ canOrganize: false }) }));
jest.mock('../../../components/feature/LiveOwnerChip', () => ({ LiveOwnerChip: () => null }));
jest.mock('../../../components/feature/RegisterFab', () => ({ RegisterFab: () => null }));
jest.mock('@cultuvilla/shared/services/eventService', () => ({
  getEvent: jest.fn().mockResolvedValue({
    id: 'e1', title: 'Verbena', startDate: new Date('2026-07-12T20:00:00Z'), endDate: null,
    description: 'baile', imageURL: null, villageCoverImage: null, location: null,
    organizerUserIds: [], organizerOrgIds: [], telephoneRequired: false,
  }),
}));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({ getEventLink: () => 'https://x' }));
jest.mock('@cultuvilla/shared/services/personService', () => ({ getPersonByUserId: jest.fn().mockResolvedValue(null) }));
jest.mock('@cultuvilla/shared/models/person/PersonDataModel', () => ({ buildDisplayName: () => 'N' }));
jest.mock('@cultuvilla/shared/utils', () => ({ formatDate: () => '12 jul', buildGoogleCalendarUrl: () => 'https://cal' }));

describe('EventDetailScreen', () => {
  it('renders the event title and the guest CTA', async () => {
    const { getByText } = render(<EventDetailScreen />);
    await waitFor(() => getByText('Verbena'));
    getByText('guest.eventCta');
  });
});
```

- [ ] **Step 3: Run the test**

Run: `pnpm --filter cultuvilla-mobile exec jest app/event`
Expected: PASS (existing `event/__tests__/new.test.tsx` stays green).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/event/
git commit -m "refactor(mobile): event detail onto EntityDetailScaffold + DetailInfoCard"
```

---

### Task 12: Delete the Floating* components and verify

**Files:**
- Delete: `apps/mobile/components/feature/FloatingBackButton.tsx`, `FloatingShareButton.tsx`, `FloatingEditButton.tsx`, `FloatingManageButton.tsx`

- [ ] **Step 1: Confirm no remaining references**

Run: `grep -rn "Floating\(Back\|Share\|Edit\|Manage\)Button" apps/mobile --include=*.tsx`
Expected: no matches (all six screens migrated in Tasks 6–11; `DetailHeroImage` cleaned in Task 4).

- [ ] **Step 2: Delete the files**

```bash
git rm apps/mobile/components/feature/FloatingBackButton.tsx \
       apps/mobile/components/feature/FloatingShareButton.tsx \
       apps/mobile/components/feature/FloatingEditButton.tsx \
       apps/mobile/components/feature/FloatingManageButton.tsx
```

- [ ] **Step 3: Run the full mobile gate**

Run: `pnpm app:typecheck && pnpm app:test`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(mobile): delete Floating* detail buttons superseded by EntityDetailHeader"
```

---

### Task 13: Document the "entity" convention in AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add the convention subsection**

Under `## Conventions`, add this subsection (place it after the `### Forms` subsection):

```markdown
### Entities

An **entity** is a village-scoped domain object that appears in a horizontal
`Section` scroll (as a `BigCard` / `EntityCard`) and opens a hero-image detail
screen. The family: **event, festival-poster (cartel), place, barrio,
organization, news**. `person` and `village` are **not** entities — they open
into forms (`ScreenHeader`), not hero-detail screens.

Every entity detail screen is a thin consumer of one scaffold,
[apps/mobile/components/feature/EntityDetailScaffold.tsx](apps/mobile/components/feature/EntityDetailScaffold.tsx):
a solid static top bar (`EntityDetailHeader` — back + action icons) above a
full-bleed flyer (`DetailHeroImage`), then title + body. Don't hand-roll a
detail screen; add a scaffold consumer. The term is also carried by
`EntityCard` and `useEntityCapabilities`; the per-kind fallback icon lives in
`apps/mobile/lib/entities/registry.ts`.
```

(If Task 14 is skipped, drop the final sentence's `registry.ts` clause.)

- [ ] **Step 2: Verify the doc is coherent**

Run: `grep -n "### Entities" AGENTS.md`
Expected: one match; read the surrounding section to confirm it reads cleanly next to its neighbours.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: document the 'entity' convention in AGENTS.md"
```

---

### Task 14 (optional): Shared entity registry

Skip if the per-screen `fallbackIcon` literals feel clear enough — this task only DRYs them into one place and gives the `EntityKind` union a home. Do it if you want the concept codified, not just documented.

**Files:**
- Create: `apps/mobile/lib/entities/registry.ts`
- Test: `apps/mobile/lib/entities/__tests__/registry.test.ts`
- Modify: the six detail screens (swap each `fallbackIcon="…"` literal for `ENTITY_FALLBACK_ICON.<kind>`).

**Interfaces:**
- Produces:
  - `type EntityKind = 'event' | 'festivalPoster' | 'place' | 'barrio' | 'organization' | 'news'`
  - `const ENTITY_FALLBACK_ICON: Record<EntityKind, keyof typeof Ionicons.glyphMap>`

- [ ] **Step 1: Write the failing test**

```ts
import { ENTITY_FALLBACK_ICON } from '../registry';

describe('entity registry', () => {
  it('maps every entity kind to a fallback icon', () => {
    expect(ENTITY_FALLBACK_ICON).toEqual({
      event: 'calendar-outline',
      festivalPoster: 'image-outline',
      place: 'location-outline',
      barrio: 'map-outline',
      organization: 'people-outline',
      news: 'newspaper-outline',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile exec jest lib/entities`
Expected: FAIL — cannot find module `../registry`.

- [ ] **Step 3: Write the implementation**

```ts
import { Ionicons } from '@expo/vector-icons';

/** The village-scoped objects that render as a scroll card and open a
 * hero-image detail screen. See the "Entities" convention in AGENTS.md. */
export type EntityKind =
  | 'event'
  | 'festivalPoster'
  | 'place'
  | 'barrio'
  | 'organization'
  | 'news';

/** Fallback Ionicon shown in DetailHeroImage / cards when an entity has no
 * image. Single source of truth for the icons the detail screens used to
 * hardcode. */
export const ENTITY_FALLBACK_ICON: Record<EntityKind, keyof typeof Ionicons.glyphMap> = {
  event: 'calendar-outline',
  festivalPoster: 'image-outline',
  place: 'location-outline',
  barrio: 'map-outline',
  organization: 'people-outline',
  news: 'newspaper-outline',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile exec jest lib/entities`
Expected: PASS.

- [ ] **Step 5: Swap the literals in the six screens**

In each screen from Tasks 6–11, import `ENTITY_FALLBACK_ICON` and replace the `fallbackIcon` literal:
- festival-poster: `fallbackIcon={ENTITY_FALLBACK_ICON.festivalPoster}`
- place: `fallbackIcon={ENTITY_FALLBACK_ICON.place}`
- barrio: `fallbackIcon={ENTITY_FALLBACK_ICON.barrio}`
- organization: `fallbackIcon={ENTITY_FALLBACK_ICON.organization}`
- news: `fallbackIcon={ENTITY_FALLBACK_ICON.news}`
- event: `fallbackIcon={ENTITY_FALLBACK_ICON.event}`

- [ ] **Step 6: Verify the gate stays green**

Run: `pnpm app:typecheck && pnpm --filter cultuvilla-mobile exec jest app/`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/lib/entities/ apps/mobile/app/
git commit -m "refactor(mobile): centralize entity fallback icons in a registry"
```

---

## Self-review

- **Spec coverage:** vocabulary → Task 5 doc comment + Task 13 (AGENTS.md) + Task 14 (`EntityKind`); static neutral bar → Tasks 1–2; flyer below bar → Task 4 + Task 5; shared scaffold → Task 5; six migrations → Tasks 6–11; delete Floating* → Task 12; opportunistic body scope → only event uses `DetailInfoCard` (Task 11), no `DetailSection`. ✅
- **Type consistency:** `EntityDetailAction` defined in Task 2 and consumed by name in Tasks 5, 7–11; `EntityDetailScaffoldProps` fields match every call site (`fallbackImageUri` only used by event; `scrollContentClassName` used by org/event; `fab` used by org/event). ✅
- **Placeholders:** none — every step carries full code or an exact command. ✅
- **CHANGELOG:** this is an internal UI refactor with no user-facing string/flow change worth a note; skip per convention (flag in PR if reviewer disagrees).
