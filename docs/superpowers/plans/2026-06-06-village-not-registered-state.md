# "Pueblo no registrado" State in Village Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user's active pueblo points at a municipality whose community is not activated, the village tab shows a "not registered yet" message and a button to request becoming its administrator, instead of the empty hub grid.

**Architecture:** Add a `communityActive` branch to the village tab screen. Reuse the existing `requestOrganizeVillage` Cloud Function and `/discover/request-organizer/[municipalityId]` screen — no new backend. The screen fetches the user's pending organizer request (via the existing `getMyOrganizerRequests` service) to decide between showing the request button or a "pending" status.

**Tech Stack:** React Native (Expo Router), TypeScript, NativeWind, jest + @testing-library/react-native, `@cultuvilla/i18n` (single locale, `es.json`).

---

## File Structure

- `packages/i18n/messages/es.json` — add `village.notRegistered.*` strings (Task 1).
- `apps/mobile/app/(tabs)/__tests__/village.test.tsx` — **new** test file for the screen (Task 2).
- `apps/mobile/app/(tabs)/village.tsx` — add pending-request fetch + inactive-community render branch (Task 2).

Reference (read-only, no changes):
- `apps/mobile/app/discover/request-organizer/[municipalityId].tsx` — the screen we route to.
- `packages/shared/src/services/organizerRequestService.ts` — `getMyOrganizerRequests(userId)`.
- `packages/shared/src/models/municipality/MunicipalityDataModel.ts` — `communityActive`, builders.

---

## Task 1: Add i18n strings

**Files:**
- Modify: `packages/i18n/messages/es.json` (the `village` object, after the `censo` block near line 209-211)

- [ ] **Step 1: Add the `notRegistered` block**

In `packages/i18n/messages/es.json`, inside the `"village": { ... }` object, add a new
`"notRegistered"` key. Place it immediately after the existing `"censo"` block. The existing code reads:

```json
    "generateInvite": "Generar invitación",
    "censo": {
      "link": "Completar mi censo"
    },
    "hub": {
```

Change it to:

```json
    "generateInvite": "Generar invitación",
    "censo": {
      "link": "Completar mi censo"
    },
    "notRegistered": {
      "body": "Este pueblo aún no está registrado en Cultuvilla. Para que forme parte necesitamos un administrador que active la comunidad y gestione sus eventos, organizaciones y vecinos.",
      "cta": "¿Te gustaría serlo?",
      "button": "Quiero ser administrador",
      "pending": "Tu solicitud está pendiente de revisión"
    },
    "hub": {
```

- [ ] **Step 2: Verify the JSON still parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/i18n/messages/es.json','utf8')); console.log('ok')"`
Expected: prints `ok` (no `SyntaxError`).

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "i18n(village): add notRegistered strings for inactive-community tab"
```

---

## Task 2: Village tab inactive-community branch (TDD)

**Files:**
- Create: `apps/mobile/app/(tabs)/__tests__/village.test.tsx`
- Modify: `apps/mobile/app/(tabs)/village.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/app/(tabs)/__tests__/village.test.tsx` with exactly this content:

```tsx
import { render } from '@testing-library/react-native';
import VillageTabScreen from '../village';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { getMyOrganizerRequests } from '@cultuvilla/shared/services/organizerRequestService';
import {
  buildMunicipalityData,
  buildVillageCommunity,
} from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';

jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipality: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  isVillageAdmin: jest.fn().mockResolvedValue(false),
}));
jest.mock('@cultuvilla/shared/services/organizerRequestService', () => ({
  getMyOrganizerRequests: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'uid-1' },
    profile: { activeMunicipalityId: 'mun1' },
    profileChecked: true,
  }),
}));
jest.mock('../../../lib/auth/useIsAppAdmin', () => ({
  useIsAppAdmin: () => ({ isAppAdmin: false }),
}));
jest.mock('../../../lib/firestoreErrorLog', () => ({
  withFirestoreErrorLog: (_label: string, fn: () => unknown) => fn(),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: jest.fn(),
}));
jest.mock('../../../components/layout/AppHeader', () => ({
  AppHeader: () => null,
}));
jest.mock('../../../components/feature/VillageDiscovery', () => ({
  VillageDiscovery: () => null,
}));
jest.mock('../../../lib/i18n', () => ({
  useT: () => ({
    locale: 'es',
    t: (key: string) => {
      const map: Record<string, string> = {
        'village.hub.events': 'Eventos',
        'village.hub.organizations': 'Organizaciones',
        'village.hub.censo': 'Censo',
        'village.hub.news': 'Anuncios',
        'village.notRegistered.body': 'Este pueblo aún no está registrado en Cultuvilla.',
        'village.notRegistered.cta': '¿Te gustaría serlo?',
        'village.notRegistered.button': 'Quiero ser administrador',
        'village.notRegistered.pending': 'Tu solicitud está pendiente de revisión',
        'village.admin.open': 'Administrar pueblo',
      };
      return map[key] ?? key;
    },
  }),
}));

const base = buildMunicipalityData({
  name: 'Sotos de Mayorga',
  province: 'Valladolid',
  comunidadAutonoma: 'Castilla y León',
  codigoINE: '47001',
});
const activeMuni = {
  ...base,
  id: 'mun1',
  communityActive: true,
  community: buildVillageCommunity({ description: 'x', adminUserId: 'admin-1' }),
};
const inactiveMuni = { ...base, id: 'mun1' }; // communityActive: false, community: null

describe('VillageTabScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the hub when the community is active', async () => {
    (getMunicipality as jest.Mock).mockResolvedValue(activeMuni);
    const { findByText } = render(<VillageTabScreen />);
    expect(await findByText('Eventos')).toBeTruthy();
  });

  it('shows the organizer CTA when the community is inactive and no request is pending', async () => {
    (getMunicipality as jest.Mock).mockResolvedValue(inactiveMuni);
    (getMyOrganizerRequests as jest.Mock).mockResolvedValue([]);
    const { findByText, queryByText } = render(<VillageTabScreen />);
    expect(await findByText('Quiero ser administrador')).toBeTruthy();
    expect(queryByText('Eventos')).toBeNull();
  });

  it('shows pending status when an organizer request is already pending', async () => {
    (getMunicipality as jest.Mock).mockResolvedValue(inactiveMuni);
    (getMyOrganizerRequests as jest.Mock).mockResolvedValue([
      { id: 'r1', userId: 'uid-1', municipalityId: 'mun1', status: 'pending' },
    ]);
    const { findByText, queryByText } = render(<VillageTabScreen />);
    expect(await findByText('Tu solicitud está pendiente de revisión')).toBeTruthy();
    expect(queryByText('Quiero ser administrador')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && pnpm jest village.test`
Expected: FAIL. The first test (`renders the hub when the community is active`) may pass, but the
second and third FAIL — the inactive branch does not exist yet, so the screen renders the hub
(`Eventos` is present, `Quiero ser administrador` is not).

- [ ] **Step 3: Add imports to `village.tsx`**

In `apps/mobile/app/(tabs)/village.tsx`, update the primitives import to add `Button`:

```tsx
import { Screen, Text, VStack, Escudo, Button } from '../../components/primitives';
```

And add the organizer-request service import after the existing `getMunicipality` import (around line 14):

```tsx
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { getMyOrganizerRequests } from '@cultuvilla/shared/services/organizerRequestService';
```

- [ ] **Step 4: Add the pending-request state**

In `village.tsx`, next to the existing state declarations (after `const [loadError, setLoadError] = useState<string | null>(null);`), add:

```tsx
  const [pendingOrganizerRequest, setPendingOrganizerRequest] = useState(false);
```

- [ ] **Step 5: Fetch the pending request inside `loadVillage`**

Replace the entire `loadVillage` callback body with the version below. It resets the new state in
the no-municipality branch and adds a third parallel fetch:

```tsx
  const loadVillage = useCallback(async () => {
    if (!activeMunicipalityId) {
      setVillage(null);
      setVillageAdmin(false);
      setPendingOrganizerRequest(false);
      setLoadError(null);
      return;
    }
    try {
      const [mun, isAdmin, myReqs] = await Promise.all([
        withFirestoreErrorLog('village:getMunicipality', () =>
          getMunicipality(activeMunicipalityId),
        ),
        user
          ? withFirestoreErrorLog('village:isVillageAdmin', () =>
              isVillageAdmin(activeMunicipalityId, user.uid),
            )
          : Promise.resolve(false),
        user
          ? withFirestoreErrorLog('village:getMyOrganizerRequests', () =>
              getMyOrganizerRequests(user.uid),
            )
          : Promise.resolve([]),
      ]);
      setVillage(mun);
      setVillageAdmin(isAdmin);
      setPendingOrganizerRequest(
        myReqs.some(
          (r) => r.municipalityId === activeMunicipalityId && r.status === 'pending',
        ),
      );
      setLoadError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[VillageTab] loadVillage ERR', msg);
      setLoadError(msg);
    }
  }, [activeMunicipalityId, user]);
```

- [ ] **Step 6: Add the inactive-community render branch**

In `village.tsx`, find the `if (!village) { ... }` spinner guard (it ends with `}` just before
`const canManage = ...`). Immediately AFTER that block and BEFORE `const canManage = isAppAdmin || villageAdmin;`, insert:

```tsx
  if (!village.communityActive) {
    return (
      <Screen padded={false} topInset={false}>
        <AppHeader centerLabel={village.name} />
        <View className="flex-1 items-center justify-center px-8">
          <VStack gap={2} className="items-center">
            <Escudo url={village.escudoUrl} size={96} fallbackInitial={village.name} />
            <Text variant="h2" className="mt-2 text-center">
              {village.name}
            </Text>
            <Text tone="muted" variant="bodySm">
              {village.province}
            </Text>
            <Text className="text-center mt-4">{t('village.notRegistered.body')}</Text>
            <Text variant="h3" className="text-center mt-2">
              {t('village.notRegistered.cta')}
            </Text>
            {pendingOrganizerRequest ? (
              <Text tone="muted" className="text-center mt-4">
                {t('village.notRegistered.pending')}
              </Text>
            ) : (
              <Button
                className="mt-4"
                onPress={() =>
                  router.push(`/discover/request-organizer/${village.id}` as never)
                }
              >
                {t('village.notRegistered.button')}
              </Button>
            )}
          </VStack>
        </View>
      </Screen>
    );
  }

```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd apps/mobile && pnpm jest village.test`
Expected: PASS — all three tests green.

- [ ] **Step 8: Typecheck and lint the changed files**

Run: `cd apps/mobile && pnpm exec tsc --noEmit`
Expected: no errors.

Run: `cd apps/mobile && pnpm exec eslint app/\(tabs\)/village.tsx app/\(tabs\)/__tests__/village.test.tsx`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/app/\(tabs\)/village.tsx apps/mobile/app/\(tabs\)/__tests__/village.test.tsx
git commit -m "feat(mobile): show 'pueblo no registrado' state with organizer CTA in village tab"
```

---

## Notes for the implementer

- The `router.push(... as never)` cast matches the existing idiom in `village.tsx` (see the
  `adminSlot` push at the top of the active-community render). Keep it consistent with the file.
- `Button` renders its string child inside a `Text` with the correct tone automatically — pass the
  translated string directly as the child (no inner `<Text>` needed), matching the `Button` primitive API.
- `getMyOrganizerRequests` returns all of the user's organizer requests; we filter client-side to
  the active municipality + `status === 'pending'`. This is cheap (a user has few requests).
- Do not touch the register / complete-profile picker — allowing selection of inactive municipalities
  is intentional (per the design doc).
