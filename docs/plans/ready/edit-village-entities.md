# Edit affordance for org / place / barrio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permission-gated edit button to the top-right of the organization, place, and barrio detail screens that opens an edit form reusing the existing `ProposableForm`.

**Architecture:** Three thin edit-route screens (`/o/[orgId]/edit`, `.../place/[placeId]/edit`, `.../barrio/[barrioId]/edit`) load the entity, seed a controlled `ProposableForm`, and submit via `updateOrganization` / `updatePlace` / `updateBarrio` (+ `upload*Image` when a new image is picked). A `FloatingEditButton` mounted on each detail screen, gated by `useEntityCapabilities` (places/barrios) or a new `useOrgCapabilities` (orgs), navigates to the edit route. Each edit route independently redirects out when the viewer lacks permission.

**Tech Stack:** React Native / Expo Router v4, NativeWind v4, `@cultuvilla/shared` services, vitest (shared), jest + @testing-library/react-native (mobile).

## Global Constraints

- Strict TypeScript, no `any`, no `@ts-nocheck`. Narrow `unknown` at boundaries. (AGENTS.md §Strict TypeScript)
- Components/screens/hooks must NOT import `firebase/*` directly — all Firebase access via `packages/shared/src/services/`. (AGENTS.md §Service-layer ownership)
- User-facing strings go through `useT()`; add new keys to `packages/i18n/messages/es.json`. (AGENTS.md §i18n)
- Authority is ALWAYS the role flag, never a founder pointer. (AGENTS.md §Membership roles)
- Styles on `Animated`/absolutely-positioned floating elements go on `style`, not `className`, so they render on RN-Web. (memory: NativeWind drops className on Animated.View; existing FloatingShareButton uses `style`.)
- Conventional commits, header ≤ 100 chars.
- Run `pnpm app:typecheck` and `pnpm app:test` (mobile) / `pnpm test` (shared) before considering a task done. Do NOT start dev servers or emulators (AGENTS.md §Never start dev servers); shared vitest mocks firebase inline, so no emulator is needed for these tasks.

---

## File Structure

New:
- `apps/mobile/components/feature/FloatingEditButton.tsx` — circular top-right edit affordance for hero detail screens.
- `apps/mobile/lib/auth/useOrgCapabilities.ts` — org-scoped edit capability (app admin ∨ village admin ∨ org admin).
- `apps/mobile/app/o/[orgId]/edit.tsx` — org edit screen.
- `apps/mobile/app/village/[villageId]/place/[placeId]/edit.tsx` — place edit screen.
- `apps/mobile/app/village/[villageId]/barrio/[barrioId]/edit.tsx` — barrio edit screen.

Modified:
- `packages/shared/src/services/orgMemberService.ts` — add `isOrgAdmin`.
- `apps/mobile/components/feature/proposable/ProposableForm.tsx` — add `existingImageUri` fallback thumbnail prop.
- `apps/mobile/app/o/[orgId].tsx` — mount edit button.
- `apps/mobile/app/village/[villageId]/place/[placeId].tsx` — mount edit button.
- `apps/mobile/app/village/[villageId]/barrio/[barrioId].tsx` — mount edit button.
- `packages/i18n/messages/es.json` — new strings.
- `packages/shared/src/services/_services-map.md` — note `isOrgAdmin`.
- `CHANGELOG.md` — `[Unreleased]` entry.

> **Expo Router note:** A leaf file `o/[orgId].tsx` and a sibling directory route `o/[orgId]/edit.tsx` coexist in Expo Router (the leaf matches `/o/123`, the nested file matches `/o/123/edit`). Do NOT create an `index.tsx` — that would collide with the leaf. Same for `place/` and `barrio/`. Verify by navigating to both routes after Task 5.

---

## Task 1: `isOrgAdmin` service helper

**Files:**
- Modify: `packages/shared/src/services/orgMemberService.ts`
- Test: `packages/shared/test/services/orgMemberService.test.ts`

**Interfaces:**
- Produces: `isOrgAdmin(orgId: string, userId: string): Promise<boolean>` — true iff the caller's membership doc exists and `role === 'admin'`.

- [ ] **Step 1: Write the failing test**

Append to `packages/shared/test/services/orgMemberService.test.ts`. Note the file mocks `organizationMemberDoc` (Task uses `getDoc`), so add `getDoc` handling. Add this describe block:

```ts
describe('isOrgAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when the membership doc has role admin', async () => {
    const { getDoc } = await import('firebase/firestore');
    const { isOrgAdmin } = await import('../../src/services/orgMemberService');
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ joinedAt: new Date(), role: 'admin' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(await isOrgAdmin('org1', 'u1')).toBe(true);
  });

  it('returns false when the member has role member', async () => {
    const { getDoc } = await import('firebase/firestore');
    const { isOrgAdmin } = await import('../../src/services/orgMemberService');
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ joinedAt: new Date(), role: 'member' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(await isOrgAdmin('org1', 'u1')).toBe(false);
  });

  it('returns false when no membership doc exists', async () => {
    const { getDoc } = await import('firebase/firestore');
    const { isOrgAdmin } = await import('../../src/services/orgMemberService');
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
      data: () => undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(await isOrgAdmin('org1', 'u1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/services/orgMemberService.test.ts`
Expected: FAIL — `isOrgAdmin` is not exported.

- [ ] **Step 3: Add the implementation**

In `packages/shared/src/services/orgMemberService.ts`, add after `isOrgMember` (around line 61):

```ts
/**
 * True iff `userId` is an admin of the org. Authority is the role flag, never
 * the founder pointer (AGENTS.md §Membership roles) — the founder is seeded as
 * admin on approval, so this covers "a group I created" without special-casing.
 */
export async function isOrgAdmin(orgId: string, userId: string): Promise<boolean> {
  const snap = await getDoc(organizationMemberDoc(getDb(), orgId, userId));
  return snap.exists() && snap.data().role === 'admin';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/services/orgMemberService.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the services map**

In `packages/shared/src/services/_services-map.md`, find the `orgMemberService` entry and add `isOrgAdmin` to its listed exports (match the existing formatting of that row/section).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/services/orgMemberService.ts \
        packages/shared/test/services/orgMemberService.test.ts \
        packages/shared/src/services/_services-map.md
git commit -m "feat(shared): add isOrgAdmin membership helper"
```

---

## Task 2: `useOrgCapabilities` hook

**Files:**
- Create: `apps/mobile/lib/auth/useOrgCapabilities.ts`
- Test: `apps/mobile/lib/auth/__tests__/useOrgCapabilities.test.tsx`

**Interfaces:**
- Consumes: `isOrgAdmin` (Task 1); `isVillageAdmin` from `villageMemberService`; `useAuth`, `useIsAppAdmin`.
- Produces: `useOrgCapabilities(orgId: string | undefined, municipalityId: string | undefined): { canManage: boolean; uid: string | null; loading: boolean }`. `canManage = isAppAdmin ∨ isOrgAdmin(orgId) ∨ isVillageAdmin(municipalityId)`. `municipalityId` may be `undefined` initially (detail screen loads the org async); when undefined the village-admin axis resolves to `false` rather than blocking.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/lib/auth/__tests__/useOrgCapabilities.test.tsx` (mirrors `useEntityCapabilities.test.tsx`):

```tsx
import { renderHook, waitFor } from '@testing-library/react-native';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';
import { isOrgAdmin } from '@cultuvilla/shared/services/orgMemberService';
import { useOrgCapabilities } from '../useOrgCapabilities';
import { useAuth } from '../useAuth';
import { useIsAppAdmin } from '../useIsAppAdmin';

jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  isVillageAdmin: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/orgMemberService', () => ({
  isOrgAdmin: jest.fn(),
}));
jest.mock('../useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../useIsAppAdmin', () => ({ useIsAppAdmin: jest.fn() }));

const mockAuth = useAuth as jest.Mock;
const mockAppAdmin = useIsAppAdmin as jest.Mock;
const mockIsVillageAdmin = isVillageAdmin as jest.Mock;
const mockIsOrgAdmin = isOrgAdmin as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue({ user: { uid: 'alice' }, loading: false });
  mockAppAdmin.mockReturnValue({ isAppAdmin: false, loading: false });
  mockIsVillageAdmin.mockResolvedValue(false);
  mockIsOrgAdmin.mockResolvedValue(false);
});

describe('useOrgCapabilities', () => {
  it('plain member: cannot manage', async () => {
    const { result } = renderHook(() => useOrgCapabilities('org1', 'm1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(false);
    expect(result.current.uid).toBe('alice');
  });

  it('org admin: can manage', async () => {
    mockIsOrgAdmin.mockResolvedValue(true);
    const { result } = renderHook(() => useOrgCapabilities('org1', 'm1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(true);
  });

  it('village admin: can manage', async () => {
    mockIsVillageAdmin.mockResolvedValue(true);
    const { result } = renderHook(() => useOrgCapabilities('org1', 'm1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(true);
  });

  it('app admin: can manage', async () => {
    mockAppAdmin.mockReturnValue({ isAppAdmin: true, loading: false });
    const { result } = renderHook(() => useOrgCapabilities('org1', 'm1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(true);
  });

  it('municipalityId undefined: resolves, org-admin axis still applies', async () => {
    mockIsOrgAdmin.mockResolvedValue(true);
    const { result } = renderHook(() => useOrgCapabilities('org1', undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(true);
    expect(mockIsVillageAdmin).not.toHaveBeenCalled();
  });

  it('unauthenticated: cannot manage, uid null', async () => {
    mockAuth.mockReturnValue({ user: null, loading: false });
    const { result } = renderHook(() => useOrgCapabilities('org1', 'm1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(false);
    expect(result.current.uid).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile exec jest lib/auth/__tests__/useOrgCapabilities.test.tsx`
Expected: FAIL — cannot find module `../useOrgCapabilities`.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/lib/auth/useOrgCapabilities.ts`:

```ts
import { useEffect, useState } from 'react';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';
import { isOrgAdmin } from '@cultuvilla/shared/services/orgMemberService';
import { useAuth } from './useAuth';
import { useIsAppAdmin } from './useIsAppAdmin';

export interface OrgCapabilities {
  /** May edit the org (app admin, village admin of its municipality, or org admin). */
  canManage: boolean;
  uid: string | null;
  loading: boolean;
}

/**
 * Edit capability for a single organization. `municipalityId` is often unknown
 * on first render (the detail screen loads the org doc async); until it arrives
 * the village-admin axis resolves to false rather than blocking, and the
 * org-admin axis (keyed only on orgId) already applies.
 */
export function useOrgCapabilities(
  orgId: string | undefined,
  municipalityId: string | undefined,
): OrgCapabilities {
  const { user, loading: authLoading } = useAuth();
  const { isAppAdmin, loading: appAdminLoading } = useIsAppAdmin();
  const [orgAdmin, setOrgAdmin] = useState<boolean | null>(null);
  const [villageAdmin, setVillageAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || !orgId) {
      setOrgAdmin(false);
      return;
    }
    let cancelled = false;
    setOrgAdmin(null);
    isOrgAdmin(orgId, user.uid).then((ok) => {
      if (!cancelled) setOrgAdmin(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [user, orgId]);

  useEffect(() => {
    if (!user || !municipalityId) {
      setVillageAdmin(false);
      return;
    }
    let cancelled = false;
    setVillageAdmin(null);
    isVillageAdmin(municipalityId, user.uid).then((ok) => {
      if (!cancelled) setVillageAdmin(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [user, municipalityId]);

  const loading =
    authLoading || appAdminLoading || orgAdmin === null || villageAdmin === null;
  const canManage = isAppAdmin || orgAdmin === true || villageAdmin === true;
  return { canManage, uid: user?.uid ?? null, loading };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile exec jest lib/auth/__tests__/useOrgCapabilities.test.tsx`
Expected: PASS (all 6 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/auth/useOrgCapabilities.ts \
        apps/mobile/lib/auth/__tests__/useOrgCapabilities.test.tsx
git commit -m "feat(mobile): add useOrgCapabilities edit-permission hook"
```

---

## Task 3: `FloatingEditButton` component + i18n

**Files:**
- Create: `apps/mobile/components/feature/FloatingEditButton.tsx`
- Modify: `packages/i18n/messages/es.json`
- Test: `apps/mobile/components/feature/__tests__/FloatingEditButton.test.tsx`

**Interfaces:**
- Produces: `FloatingEditButton({ onPress }: { onPress: () => void })` — circular pencil affordance, positioned top-right at `right: 60` (to the left of `FloatingShareButton`'s `right: 12`). Uses i18n key `common.edit` for its accessibility label.

- [ ] **Step 1: Add the i18n string**

In `packages/i18n/messages/es.json`, under the `common` object, add `"edit": "Editar"` if it is not already present. First check: `grep -n '"edit"' packages/i18n/messages/es.json`. If `common.edit` already exists, skip this step and reuse it.

- [ ] **Step 2: Write the failing test**

Create `apps/mobile/components/feature/__tests__/FloatingEditButton.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { FloatingEditButton } from '../FloatingEditButton';

jest.mock('../../../lib/i18n', () => ({
  useT: () => ({ t: (k: string) => k }),
}));

describe('FloatingEditButton', () => {
  it('invokes onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<FloatingEditButton onPress={onPress} />);
    fireEvent.press(getByLabelText('common.edit'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile exec jest components/feature/__tests__/FloatingEditButton.test.tsx`
Expected: FAIL — cannot find module `../FloatingEditButton`.

- [ ] **Step 4: Write the implementation**

Create `apps/mobile/components/feature/FloatingEditButton.tsx` (mirrors `FloatingShareButton.tsx`; sits at `right: 60` so it pairs to the left of the share button):

```tsx
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from '../primitives/Pressable';
import { useT } from '../../lib/i18n';

/**
 * Circular edit affordance floating over the top-right of a detail-screen hero,
 * to the left of {@link FloatingShareButton}. Rendered only when the viewer has
 * edit permission (the parent screen decides). Styles live on `style` (never
 * `className`) so the button renders on RN-Web.
 */
export function FloatingEditButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top + 8,
        right: 60,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.45)',
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityLabel={t('common.edit')}
        className="flex-1 items-center justify-center"
      >
        <Ionicons name="create-outline" size={22} color="#fff" />
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile exec jest components/feature/__tests__/FloatingEditButton.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/feature/FloatingEditButton.tsx \
        apps/mobile/components/feature/__tests__/FloatingEditButton.test.tsx \
        packages/i18n/messages/es.json
git commit -m "feat(mobile): add FloatingEditButton hero affordance"
```

---

## Task 4: `existingImageUri` fallback prop on `ProposableForm`

**Files:**
- Modify: `apps/mobile/components/feature/proposable/ProposableForm.tsx`
- Test: `apps/mobile/components/feature/proposable/__tests__/ProposableForm.test.tsx` (create if absent)

**Interfaces:**
- Produces: `ProposableForm` gains optional `existingImageUri?: string | null`. The image thumbnail resolves to `image?.previewUri ?? existingImageUri ?? null`, so an edit screen can display the entity's current picture before the user picks a new one. Backward compatible — create screens omit it.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/components/feature/proposable/__tests__/ProposableForm.test.tsx` (if it exists, add the `it` block into the existing describe):

```tsx
import { render } from '@testing-library/react-native';
import { ProposableForm } from '../ProposableForm';

jest.mock('../../../../lib/i18n', () => ({ useT: () => ({ t: (k: string) => k }) }));
jest.mock('../../../../lib/images', () => ({ pickImageAsBlob: jest.fn() }));

describe('ProposableForm existingImageUri', () => {
  it('renders the existing image as the picker thumbnail when no image is picked', () => {
    const { UNSAFE_getAllByProps } = render(
      <ProposableForm
        image={null}
        onImageChange={() => {}}
        existingImageUri="https://example.com/escudo.png"
        imageLabels={{ add: 'add', selected: 'selected' }}
        name="Peña"
        onChangeName={() => {}}
        nameLabel="name"
        submitLabel="save"
        onSubmit={() => {}}
        saving={false}
        disabled={false}
      />,
    );
    // ImagePickerField receives the existing URL as its `uri` prop.
    expect(
      UNSAFE_getAllByProps({ uri: 'https://example.com/escudo.png' }).length,
    ).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile exec jest components/feature/proposable/__tests__/ProposableForm.test.tsx`
Expected: FAIL — the `uri` prop resolves to `null` because `existingImageUri` isn't wired.

- [ ] **Step 3: Write the implementation**

In `apps/mobile/components/feature/proposable/ProposableForm.tsx`:

Add to `ProposableFormProps` (after the `imageLabels` field, ~line 17):

```ts
  /** Existing stored image URL to show as the thumbnail before the user picks a
   * new one (edit mode). Falls back behind a freshly-picked `image`. */
  existingImageUri?: string | null;
```

Add `existingImageUri` to the destructured params (after `imageLabels`, ~line 57) and change the `ImagePickerField` `uri` prop (~line 86) from:

```tsx
            uri={image?.previewUri ?? null}
```

to:

```tsx
            uri={image?.previewUri ?? existingImageUri ?? null}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile exec jest components/feature/proposable/__tests__/ProposableForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feature/proposable/ProposableForm.tsx \
        apps/mobile/components/feature/proposable/__tests__/ProposableForm.test.tsx
git commit -m "feat(mobile): support existing-image thumbnail in ProposableForm"
```

---

## Task 5: Barrio edit route + edit button on barrio detail

**Files:**
- Create: `apps/mobile/app/village/[villageId]/barrio/[barrioId]/edit.tsx`
- Modify: `apps/mobile/app/village/[villageId]/barrio/[barrioId].tsx`
- Modify: `packages/i18n/messages/es.json`
- Test: `apps/mobile/app/village/[villageId]/barrio/__tests__/edit.test.tsx`

**Interfaces:**
- Consumes: `FloatingEditButton` (Task 3), `existingImageUri` prop (Task 4), `useEntityCapabilities`, `getBarrio`/`updateBarrio` (`municipalityService`), `uploadBarrioImage` (`imageService`).

- [ ] **Step 1: Add i18n strings**

In `packages/i18n/messages/es.json`, under `village.admin.barrios`, add:

```json
"editTitle": "Editar barrio"
```

- [ ] **Step 2: Write the failing test (permission guard)**

Create `apps/mobile/app/village/[villageId]/barrio/__tests__/edit.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import BarrioEditScreen from '../[barrioId]/edit';

const mockRedirect = jest.fn(() => null);
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1', barrioId: 'b1' }),
  Redirect: (props: { href: string }) => mockRedirect(props),
  router: { back: jest.fn() },
}));
jest.mock('../../../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getBarrio: jest.fn().mockResolvedValue({ id: 'b1', name: 'Centro', imageURL: null, municipalityId: 'm1' }),
  updateBarrio: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({ uploadBarrioImage: jest.fn() }));

import { useEntityCapabilities } from '../../../../../lib/auth/useEntityCapabilities';

describe('BarrioEditScreen guard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('redirects to the barrio detail when the viewer cannot manage', () => {
    (useEntityCapabilities as jest.Mock).mockReturnValue({ canManage: false, uid: 'u1', loading: false });
    render(<BarrioEditScreen />);
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/village/m1/barrio/b1' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile exec jest app/village/\\[villageId\\]/barrio/__tests__/edit.test.tsx`
Expected: FAIL — cannot find module `../[barrioId]/edit`.

- [ ] **Step 4: Write the barrio edit screen**

Create `apps/mobile/app/village/[villageId]/barrio/[barrioId]/edit.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useLocalSearchParams, Redirect, router } from 'expo-router';
import { Screen } from '../../../../../components/primitives/Screen';
import { Text } from '../../../../../components/primitives/Text';
import { ScreenHeader } from '../../../../../components/layout/ScreenHeader';
import { ProposableForm } from '../../../../../components/feature/proposable/ProposableForm';
import { useT } from '../../../../../lib/i18n';
import { useEntityCapabilities } from '../../../../../lib/auth/useEntityCapabilities';
import { getBarrio, updateBarrio } from '@cultuvilla/shared/services/municipalityService';
import { uploadBarrioImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';

export default function BarrioEditScreen() {
  const { villageId, barrioId } = useLocalSearchParams<{ villageId: string; barrioId: string }>();
  const { t } = useT();
  const { canManage, loading: capLoading } = useEntityCapabilities(villageId);
  const [name, setName] = useState('');
  const [existingImageUri, setExistingImageUri] = useState<string | null>(null);
  const [image, setImage] = useState<UploadableImage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!villageId || !barrioId) return;
    void (async () => {
      const b = await getBarrio(villageId, barrioId);
      if (b) {
        setName(b.name);
        setExistingImageUri(b.imageURL ?? null);
      } else {
        setNotFound(true);
      }
      setLoaded(true);
    })();
  }, [villageId, barrioId]);

  if (capLoading) {
    return (
      <Screen padded={false} topInset={false}>
        <ScreenHeader accent title={t('village.admin.barrios.editTitle')} />
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      </Screen>
    );
  }
  if (!canManage) return <Redirect href={`/village/${villageId}/barrio/${barrioId}`} />;

  async function submit() {
    if (!villageId || !barrioId || !name.trim()) return;
    setSaving(true);
    try {
      await updateBarrio(villageId, barrioId, { name: name.trim() });
      if (image) {
        const imageURL = await uploadBarrioImage(villageId, barrioId, image);
        await updateBarrio(villageId, barrioId, { imageURL });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false} topInset={false}>
      <ScreenHeader accent title={t('village.admin.barrios.editTitle')} />
      {!loaded ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      ) : notFound ? (
        <View className="flex-1 items-center justify-center"><Text>{t('common.notFound')}</Text></View>
      ) : (
        <ScrollView contentContainerClassName="p-4">
          <ProposableForm
            image={image}
            onImageChange={setImage}
            existingImageUri={existingImageUri}
            imageLabels={{
              add: t('village.admin.barrios.addImage'),
              selected: t('village.admin.barrios.imageSelected'),
            }}
            name={name}
            onChangeName={setName}
            nameLabel={t('village.admin.barrios.name')}
            nameTestID="barrio-edit-name-input"
            submitLabel={t('common.save')}
            submitTestID="barrio-edit-submit"
            onSubmit={submit}
            saving={saving}
            disabled={!name.trim()}
          />
        </ScrollView>
      )}
    </Screen>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile exec jest app/village/\\[villageId\\]/barrio/__tests__/edit.test.tsx`
Expected: PASS.

- [ ] **Step 6: Mount the edit button on the barrio detail screen**

In `apps/mobile/app/village/[villageId]/barrio/[barrioId].tsx`:

Add imports:

```tsx
import { FloatingEditButton } from '../../../../components/feature/FloatingEditButton';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';
```

Inside the component, after the existing state, add:

```tsx
  const { canManage } = useEntityCapabilities(villageId);
```

In the rendered hero block (after `<FloatingShareButton ... />`, ~line 70), add:

```tsx
        {canManage ? (
          <FloatingEditButton
            onPress={() => router.push(`/village/${villageId}/barrio/${barrio.id}/edit` as never)}
          />
        ) : null}
```

(`router` is already imported in this file.)

- [ ] **Step 7: Typecheck + run mobile tests**

Run: `pnpm app:typecheck && pnpm --filter cultuvilla-mobile exec jest app/village/\\[villageId\\]/barrio`
Expected: typecheck clean; barrio tests PASS.

- [ ] **Step 8: Commit**

```bash
git add "apps/mobile/app/village/[villageId]/barrio/[barrioId]/edit.tsx" \
        "apps/mobile/app/village/[villageId]/barrio/[barrioId].tsx" \
        "apps/mobile/app/village/[villageId]/barrio/__tests__/edit.test.tsx" \
        packages/i18n/messages/es.json
git commit -m "feat(mobile): edit barrio from detail screen"
```

---

## Task 6: Place edit route + edit button on place detail

**Files:**
- Create: `apps/mobile/app/village/[villageId]/place/[placeId]/edit.tsx`
- Modify: `apps/mobile/app/village/[villageId]/place/[placeId].tsx`
- Modify: `packages/i18n/messages/es.json`
- Test: `apps/mobile/app/village/[villageId]/place/__tests__/edit.test.tsx`

**Interfaces:**
- Consumes: same as Task 5 plus `PLACE_KINDS`/`PlaceKind` from `@cultuvilla/shared/models/municipality`, `getPlace`/`updatePlace`, `uploadPlaceImage`. Editable fields: name, description, kind, image (mirrors the create form in `PlacesManager`).

- [ ] **Step 1: Add i18n string**

In `packages/i18n/messages/es.json`, under `village.admin.places`, add:

```json
"editTitle": "Editar lugar"
```

- [ ] **Step 2: Write the failing test (permission guard)**

Create `apps/mobile/app/village/[villageId]/place/__tests__/edit.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import PlaceEditScreen from '../[placeId]/edit';

const mockRedirect = jest.fn(() => null);
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1', placeId: 'p1' }),
  Redirect: (props: { href: string }) => mockRedirect(props),
  router: { back: jest.fn() },
}));
jest.mock('../../../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getPlace: jest.fn().mockResolvedValue({
    id: 'p1', name: 'Plaza', kind: 'cemetery', description: '', imageURL: null, municipalityId: 'm1',
  }),
  updatePlace: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({ uploadPlaceImage: jest.fn() }));

import { useEntityCapabilities } from '../../../../../lib/auth/useEntityCapabilities';

describe('PlaceEditScreen guard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('redirects to the place detail when the viewer cannot manage', () => {
    (useEntityCapabilities as jest.Mock).mockReturnValue({ canManage: false, uid: 'u1', loading: false });
    render(<PlaceEditScreen />);
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/village/m1/place/p1' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile exec jest app/village/\\[villageId\\]/place/__tests__/edit.test.tsx`
Expected: FAIL — cannot find module `../[placeId]/edit`.

- [ ] **Step 4: Write the place edit screen**

Create `apps/mobile/app/village/[villageId]/place/[placeId]/edit.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useLocalSearchParams, Redirect, router } from 'expo-router';
import { Screen } from '../../../../../components/primitives/Screen';
import { Text } from '../../../../../components/primitives/Text';
import { ScreenHeader } from '../../../../../components/layout/ScreenHeader';
import { ProposableForm } from '../../../../../components/feature/proposable/ProposableForm';
import { useT } from '../../../../../lib/i18n';
import { useEntityCapabilities } from '../../../../../lib/auth/useEntityCapabilities';
import { getPlace, updatePlace } from '@cultuvilla/shared/services/municipalityService';
import { uploadPlaceImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import { PLACE_KINDS, type PlaceKind } from '@cultuvilla/shared/models/municipality';

export default function PlaceEditScreen() {
  const { villageId, placeId } = useLocalSearchParams<{ villageId: string; placeId: string }>();
  const { t } = useT();
  const { canManage, loading: capLoading } = useEntityCapabilities(villageId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<PlaceKind>('cemetery');
  const [existingImageUri, setExistingImageUri] = useState<string | null>(null);
  const [image, setImage] = useState<UploadableImage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const kindLabel = (k: PlaceKind) => t(`village.admin.places.kind.${k}` as never);

  useEffect(() => {
    if (!villageId || !placeId) return;
    void (async () => {
      const p = await getPlace(villageId, placeId);
      if (p) {
        setName(p.name);
        setDescription(p.description ?? '');
        setKind(p.kind);
        setExistingImageUri(p.imageURL ?? null);
      } else {
        setNotFound(true);
      }
      setLoaded(true);
    })();
  }, [villageId, placeId]);

  if (capLoading) {
    return (
      <Screen padded={false} topInset={false}>
        <ScreenHeader accent title={t('village.admin.places.editTitle')} />
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      </Screen>
    );
  }
  if (!canManage) return <Redirect href={`/village/${villageId}/place/${placeId}`} />;

  async function submit() {
    if (!villageId || !placeId || !name.trim()) return;
    setSaving(true);
    try {
      await updatePlace(villageId, placeId, {
        name: name.trim(), kind, description: description.trim(),
      });
      if (image) {
        const imageURL = await uploadPlaceImage(villageId, placeId, image);
        await updatePlace(villageId, placeId, { imageURL });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false} topInset={false}>
      <ScreenHeader accent title={t('village.admin.places.editTitle')} />
      {!loaded ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      ) : notFound ? (
        <View className="flex-1 items-center justify-center"><Text>{t('common.notFound')}</Text></View>
      ) : (
        <ScrollView contentContainerClassName="p-4">
          <ProposableForm
            image={image}
            onImageChange={setImage}
            existingImageUri={existingImageUri}
            imageLabels={{
              add: t('village.admin.places.addImage'),
              selected: t('village.admin.places.imageSelected'),
            }}
            name={name}
            onChangeName={setName}
            nameLabel={t('village.admin.places.name')}
            nameTestID="place-edit-name-input"
            description={description}
            onChangeDescription={setDescription}
            descriptionLabel={t('village.admin.places.description')}
            typeLabel={t('village.admin.places.kindLabel')}
            typeOptions={PLACE_KINDS.map((k) => ({ value: k, label: kindLabel(k) }))}
            typeValue={kind}
            onChangeType={(v) => setKind(v as PlaceKind)}
            submitLabel={t('common.save')}
            submitTestID="place-edit-submit"
            onSubmit={submit}
            saving={saving}
            disabled={!name.trim()}
          />
        </ScrollView>
      )}
    </Screen>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile exec jest app/village/\\[villageId\\]/place/__tests__/edit.test.tsx`
Expected: PASS.

- [ ] **Step 6: Mount the edit button on the place detail screen**

In `apps/mobile/app/village/[villageId]/place/[placeId].tsx`:

Add imports:

```tsx
import { FloatingEditButton } from '../../../../components/feature/FloatingEditButton';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';
```

After the existing state, add:

```tsx
  const { canManage } = useEntityCapabilities(villageId);
```

After `<FloatingShareButton ... />` (~line 69) add:

```tsx
        {canManage ? (
          <FloatingEditButton
            onPress={() => router.push(`/village/${villageId}/place/${place.id}/edit` as never)}
          />
        ) : null}
```

(`router` is already imported.)

- [ ] **Step 7: Typecheck + run place tests**

Run: `pnpm app:typecheck && pnpm --filter cultuvilla-mobile exec jest app/village/\\[villageId\\]/place`
Expected: typecheck clean; tests PASS.

- [ ] **Step 8: Commit**

```bash
git add "apps/mobile/app/village/[villageId]/place/[placeId]/edit.tsx" \
        "apps/mobile/app/village/[villageId]/place/[placeId].tsx" \
        "apps/mobile/app/village/[villageId]/place/__tests__/edit.test.tsx" \
        packages/i18n/messages/es.json
git commit -m "feat(mobile): edit place from detail screen"
```

---

## Task 7: Org edit route + edit button on org detail

**Files:**
- Create: `apps/mobile/app/o/[orgId]/edit.tsx`
- Modify: `apps/mobile/app/o/[orgId].tsx`
- Modify: `packages/i18n/messages/es.json`
- Test: `apps/mobile/app/o/__tests__/edit.test.tsx`

**Interfaces:**
- Consumes: `FloatingEditButton`, `existingImageUri`, `useOrgCapabilities` (Task 2), `getOrganization`/`updateOrganization` (`organizationService`), `uploadOrganizationImage` (`imageService`), `PROPOSABLE_ORGANIZATION_TYPES`/`OrganizationType`. Editable fields: name, description, type, image. `description` is `string | null` in the model — write `description.trim() || null`.

- [ ] **Step 1: Add i18n string**

In `packages/i18n/messages/es.json`, under `organization`, add:

```json
"editTitle": "Editar agrupación"
```

- [ ] **Step 2: Write the failing test (permission guard)**

Create `apps/mobile/app/o/__tests__/edit.test.tsx`:

```tsx
import { render, waitFor } from '@testing-library/react-native';
import OrgEditScreen from '../[orgId]/edit';

const mockRedirect = jest.fn(() => null);
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ orgId: 'org1' }),
  Redirect: (props: { href: string }) => mockRedirect(props),
  router: { back: jest.fn() },
}));
jest.mock('../../../lib/auth/useOrgCapabilities', () => ({
  useOrgCapabilities: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getOrganization: jest.fn().mockResolvedValue({
    id: 'org1', name: 'Peña', description: null, type: 'peña', imageURL: null, municipalityId: 'm1',
  }),
  updateOrganization: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({ uploadOrganizationImage: jest.fn() }));

import { useOrgCapabilities } from '../../../lib/auth/useOrgCapabilities';

describe('OrgEditScreen guard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('redirects to the org detail when the viewer cannot manage', async () => {
    (useOrgCapabilities as jest.Mock).mockReturnValue({ canManage: false, uid: 'u1', loading: false });
    render(<OrgEditScreen />);
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith({ href: '/o/org1' }));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile exec jest app/o/__tests__/edit.test.tsx`
Expected: FAIL — cannot find module `../[orgId]/edit`.

- [ ] **Step 4: Write the org edit screen**

Create `apps/mobile/app/o/[orgId]/edit.tsx`. Note `useOrgCapabilities` needs the org's `municipalityId`, known only after load; pass it once loaded (undefined until then — the hook tolerates that).

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useLocalSearchParams, Redirect, router } from 'expo-router';
import { Screen } from '../../../components/primitives/Screen';
import { Text } from '../../../components/primitives/Text';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { ProposableForm } from '../../../components/feature/proposable/ProposableForm';
import { useT } from '../../../lib/i18n';
import { useOrgCapabilities } from '../../../lib/auth/useOrgCapabilities';
import { getOrganization, updateOrganization } from '@cultuvilla/shared/services/organizationService';
import { uploadOrganizationImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import {
  PROPOSABLE_ORGANIZATION_TYPES,
  type OrganizationType,
} from '@cultuvilla/shared/models/organization/OrganizationDataModel';

export default function OrgEditScreen() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const { t } = useT();
  const [municipalityId, setMunicipalityId] = useState<string | undefined>(undefined);
  const { canManage, loading: capLoading } = useOrgCapabilities(orgId, municipalityId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<OrganizationType>('peña');
  const [existingImageUri, setExistingImageUri] = useState<string | null>(null);
  const [image, setImage] = useState<UploadableImage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const typeLabel = (ty: OrganizationType) => t(`organization.${ty}` as never);

  useEffect(() => {
    if (!orgId) return;
    void (async () => {
      const o = await getOrganization(orgId);
      if (o) {
        setName(o.name);
        setDescription(o.description ?? '');
        setType(o.type);
        setExistingImageUri(o.imageURL ?? null);
        setMunicipalityId(o.municipalityId);
      } else {
        setNotFound(true);
      }
      setLoaded(true);
    })();
  }, [orgId]);

  if (capLoading) {
    return (
      <Screen padded={false} topInset={false}>
        <ScreenHeader accent title={t('organization.editTitle')} />
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      </Screen>
    );
  }
  if (!canManage) return <Redirect href={`/o/${orgId}`} />;

  async function submit() {
    if (!orgId || !name.trim()) return;
    setSaving(true);
    try {
      await updateOrganization(orgId, {
        name: name.trim(),
        description: description.trim() || null,
        type,
      });
      if (image) {
        const imageURL = await uploadOrganizationImage(orgId, image);
        await updateOrganization(orgId, { imageURL });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false} topInset={false}>
      <ScreenHeader accent title={t('organization.editTitle')} />
      {!loaded ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      ) : notFound ? (
        <View className="flex-1 items-center justify-center"><Text>{t('common.notFound')}</Text></View>
      ) : (
        <ScrollView contentContainerClassName="p-4">
          <ProposableForm
            image={image}
            onImageChange={setImage}
            existingImageUri={existingImageUri}
            imageLabels={{
              add: t('organization.addImage'),
              selected: t('organization.imageSelected'),
            }}
            name={name}
            onChangeName={setName}
            nameLabel={t('organization.name')}
            nameTestID="org-edit-name-input"
            description={description}
            onChangeDescription={setDescription}
            descriptionLabel={t('organization.description')}
            typeLabel={t('organization.type')}
            typeOptions={PROPOSABLE_ORGANIZATION_TYPES.map((ty) => ({ value: ty, label: typeLabel(ty) }))}
            typeValue={type}
            onChangeType={(v) => setType(v as OrganizationType)}
            submitLabel={t('common.save')}
            submitTestID="org-edit-submit"
            onSubmit={submit}
            saving={saving}
            disabled={!name.trim()}
          />
        </ScrollView>
      )}
    </Screen>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile exec jest app/o/__tests__/edit.test.tsx`
Expected: PASS.

- [ ] **Step 6: Mount the edit button on the org detail screen**

In `apps/mobile/app/o/[orgId].tsx`:

Add imports:

```tsx
import { FloatingEditButton } from '../../components/feature/FloatingEditButton';
import { useOrgCapabilities } from '../../lib/auth/useOrgCapabilities';
import { router } from 'expo-router';
```

(Note: this file currently imports only `useLocalSearchParams` from `expo-router` — add `router` to that import instead of a duplicate line if you prefer: `import { useLocalSearchParams, router } from 'expo-router';`.)

After the `org` state is available, add the capability hook (pass the loaded org's municipalityId):

```tsx
  const { canManage } = useOrgCapabilities(orgId as string, org?.municipalityId);
```

Place this after the `org` state declaration; `org` is `null` until loaded, so `canManage` is false until then — the button appears once the org resolves and the viewer qualifies.

In the hero block, after `<FloatingShareButton ... />` (~line 88), add:

```tsx
        {canManage ? (
          <FloatingEditButton onPress={() => router.push(`/o/${org.id}/edit` as never)} />
        ) : null}
```

- [ ] **Step 7: Typecheck + run org tests**

Run: `pnpm app:typecheck && pnpm --filter cultuvilla-mobile exec jest app/o`
Expected: typecheck clean; tests PASS.

- [ ] **Step 8: Commit**

```bash
git add "apps/mobile/app/o/[orgId]/edit.tsx" \
        "apps/mobile/app/o/[orgId].tsx" \
        "apps/mobile/app/o/__tests__/edit.test.tsx" \
        packages/i18n/messages/es.json
git commit -m "feat(mobile): edit organization from detail screen"
```

---

## Task 8: Full check + CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the CHANGELOG entry**

Under `## [Unreleased]` in `CHANGELOG.md`, add a bullet (match the existing style):

```markdown
- Edit button on organization, place, and barrio detail screens for users with edit permission (org/village/app admins), reusing the creation form.
```

- [ ] **Step 2: Run the full mobile + shared suites and typecheck**

Run: `pnpm app:typecheck`
Run: `pnpm --filter cultuvilla-mobile exec jest`
Run: `pnpm --filter @cultuvilla/shared exec vitest run`
Expected: all PASS.

- [ ] **Step 3: Run the CI gate**

Run: `pnpm check`
Expected: lint + typecheck + test + build PASS. (This runs the shared/functions ESLint gate and the i18n/mobile typecheck; if it flags anything in touched files, fix inline.)

- [ ] **Step 4: Manual verification (ask the user — do NOT start dev servers)**

Ask the user to run the app and verify, since agents don't start Metro (AGENTS.md §Never start dev servers):
1. As a village admin, open a place, barrio, and org detail → edit button (top-right, left of share) appears; tapping opens the edit form pre-filled; saving persists and returns to the detail screen with updates visible.
2. As a plain member (non-admin, non-org-admin), the edit button does NOT appear; navigating directly to `/o/<id>/edit` redirects back to the detail screen.
3. As the org founder (seeded admin), the org edit button appears.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for edit affordance on detail screens"
```

---

## Self-Review notes (addressed)

- **Spec coverage:** permission model → Tasks 1, 2 (+ reuse of `useEntityCapabilities`); edit button → Task 3, mounted in 5/6/7; edit surface reusing `ProposableForm` → Tasks 4–7; per-entity field editability → 5 (barrio: name+image), 6 (place: +description+kind), 7 (org: +description+type); i18n → folded into 3/5/6/7; docs → 1 (services map), 8 (CHANGELOG).
- **Spec deviation:** the spec said "no changes to `ProposableForm`"; Task 4 adds a small backward-compatible `existingImageUri` prop so the edit form can show the current image before a new pick. This is the minimal change needed and doesn't alter create-mode behavior.
- **Type consistency:** `useOrgCapabilities(orgId, municipalityId)` signature is used identically in Task 2 (definition), Task 7 (org detail + edit). `isOrgAdmin(orgId, userId)` consistent across Tasks 1–2. `existingImageUri` prop consistent across Tasks 4–7. `updateOrganization` description written as `string | null` matching the model; `updatePlace`/`updateBarrio` fields match `PlacesManager`/`BarriosManager` submit shapes.
- **Placeholder scan:** none — every code step contains full content.
```
