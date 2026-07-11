# Own-profile village + barrio editor (add / leave your own villages)

**Goal:** Make the own-profile residence step manage the villages you belong to —
add a village (= join), pick a barrio per village, and leave a village (with
confirmation) — instead of the current read-only membership list that only lets
you edit barrios.

## Context

The person edit stepper ([apps/mobile/components/feature/PersonForm.tsx](../../../apps/mobile/components/feature/PersonForm.tsx))
injects a different residence editor depending on who is being edited:

- **Persona** (a person with no account — `person.userId === null`): the
  multi-village [ResidenceLinksEditor](../../../apps/mobile/components/feature/ResidenceLinksEditor.tsx)
  — freely add/remove rows, each with a `VillagePicker` **and** a `BarrioPicker`.
- **Your own profile** (account-holder): [MembershipBarrioList](../../../apps/mobile/components/feature/MembershipBarrioList.tsx)
  — one **read-only** row per village you've joined, with a `BarrioPicker` only.
  No way to add or leave a village here.

This asymmetry is what prompted the change: a persona can express "resident of
these pueblos, in these barrios," but your own profile can only edit barrios for
villages you happened to join elsewhere (discovery). The desired behaviour is that
your own profile also lets you add and leave villages, with the village on an
already-joined row fixed (barrio-only) — matching the persona editor's shape
without the free-swap.

### Why the two concepts can't be merged (this stays a UI change, not a model change)

Residence and membership are **two separate docs**, and this is irreducible:

| | `person.municipalityLinks` (residence) | `municipalities/{id}/members/{uid}` (membership) |
|---|---|---|
| Means | "resident of barrio X in village Y" | role + `joinedAt`; the feed/permission grant |
| Who | **everyone** — personas *and* accounts | **account-holders only** (keyed by Firebase uid) |
| Read by | censo / residents-by-barrio query only | `firestore.rules`, feed, permissions |
| Barrio | yes (`barrioId`) | **no** — deliberately removed |

A **persona has no uid**, so it can never have a membership doc
([firestore.rules](../../../firestore.rules) member-create requires an
authenticated owner; [docs/decisions/per-village-barrio-membership.md](../../decisions/per-village-barrio-membership.md)).
That is the permanent case where *adding a village ≠ joining*. The barrio lives
only on the residence link (the member doc's `barrioId` was removed in the
single-source refactor), so residence can't collapse into membership. The
simplification is therefore purely at the **UI / write-path** layer: one mental
model per context, not one data model.

### Builds directly on the shipped single-source refactor

[docs/plans/ongoing/residence-single-source-refactor.md](../ongoing/residence-single-source-refactor.md)
already landed the machinery this feature needs and **explicitly deferred the leave
flow to "when a leave flow lands" — this is that flow**:

- `joinVillage` is now an **atomic client `writeBatch`** { create `members/{uid}`,
  upsert the residence link via `buildResidenceLinks` } and sets
  `activeMunicipalityId`. `ensureVillageMembership` wraps it and routes **dormant**
  communities through the `startVillage` callable.
- `updateResidenceBarrio` writes the person doc directly (read-modify-write via
  `buildResidenceLinks`).
- **Self-leave was specified as an atomic batch { delete `members/{uid}`, remove the
  matching `municipalityLinks` entry } but left unwired** — `removeVillageMember`
  currently has no caller. The delete-trigger `syncMemberBarrioToResidence` still
  fires on the member delete and is an idempotent no-op once the link is already
  gone.
- **Invariant (load-bearing):** every residence-link write — client or server —
  constructs the entry via `buildResidenceLinks`, or the exact-object
  `array-contains` censo query silently drops that resident.

## Design / approach

### New component: `MembershipVillageEditor` (replaces `MembershipBarrioList`)

Own-profile / account-holder editor. `ResidenceLinksEditor` (personas) is untouched.
The two are **not** merged behind a mode flag: the account version carries async
membership writes, the dormant-village branch, a leave confirmation, and
active-village reassignment that the persona version must never perform. They may
share small presentational pieces (the escudo + name header row, the barrio field),
but the top-level behaviour differs.

Rows are the caller's memberships (from `getUserMemberships`), barrio read from the
person's `municipalityLinks`:

- **Joined row** — fixed village header (`Escudo` + name, *not* a picker) +
  editable `BarrioPicker` + a leave button. Changing the barrio →
  `updateResidenceBarrio` (immediate, unchanged).
- **"Add village" row** — a `VillagePicker` at the bottom. Selecting a village →
  `ensureVillageMembership(userId, municipalityId)` (join now; dormant → callable).
  On success it becomes a fixed joined row.
- **Empty state** — no memberships yet → just the add row.

All writes stay **immediate / fire-and-forget per row**, matching today's
`MembershipBarrioList` model (own-persona form submits already omit
`municipalityLinks` — [person/[personId].tsx:148-149](../../../apps/mobile/app/person/[personId].tsx#L148)).

### No village swapping on a joined row

A joined row's village is fixed — you can only change its barrio. To move to another
village you leave and add a new one. This deliberately avoids the
"change village = leave-old + join-new" cascade.

### Leave = confirmed atomic batch

Removing a joined row:

1. **Confirmation dialog** first ("You'll stop seeing this village's content" — final
   copy via i18n). Reuse the confirm mechanism behind
   [DeleteHeaderButton](../../../apps/mobile/components/feature/DeleteHeaderButton.tsx),
   **not** `Alert.alert` (a no-op on the web build — known gotcha).
2. On confirm → wire the **atomic self-leave batch** the single-source refactor
   specified: `writeBatch` { delete `members/{uid}`, remove the matching
   `municipalityLinks` entry via a `buildResidenceLinks`-shaped filter }. Add this as
   `leaveVillage(userId, municipalityId)` in `villageMemberService` (the first real
   caller of the leave path). The delete-trigger double-fires harmlessly.
3. **`activeMunicipalityId` reassignment** — if the left village was the active one,
   set it to another remaining membership, or `null` if none remain. (`joinVillage`
   sets active on join; nothing resets it on leave today — this feature must.)

### Model — unchanged

No schema change, no rules change. `municipalityLinks` and `members/{uid}` stay two
docs; barrio stays on the link. Only the mobile edit surface and a new
`leaveVillage` service function change.

## Out of scope

- **Merging `ResidenceLinksEditor` and the new editor into one component.** Rejected:
  the account path's membership side effects and confirmation don't belong in the
  persona path.
- **Any change to the residence/membership data model or rules.** The single-source
  refactor already settled that; this is UI + one service function.
- **Server-side barrio validation.** Still deferred to the shared-callable upgrade
  path named in the single-source refactor.
- **Joining from anywhere other than discovery + this editor.** No new join entry
  points.

## Resolved decisions

- **Active-village reassignment** — only touch `activeMunicipalityId` when the *left*
  village was the active one. Then reassign to the first remaining membership by a
  stable order (village name); `null` only if none remain.
- **Leave-confirmation copy** — new i18n keys under `profile.personForm` for the
  leave dialog (title + "you'll stop seeing this village's content" body + confirm /
  cancel labels). Reuse existing keys where they fit: `profile.personForm.addVillage`,
  `village`, `barrio`, `wholeVillage`.

## File Structure

**Modify:**

- `packages/shared/src/services/villageMemberService.ts` — replace the caller-less
  `removeVillageMember` (bare `deleteDoc`) with `leaveVillage(municipalityId, userId)`:
  an atomic `writeBatch` { delete `members/{uid}`, remove the matching
  `municipalityLinks` entry on the caller's person doc via a `buildResidenceLinks`-shaped
  rewrite }.
- `packages/shared/src/services/_services-map.md` — reflect `leaveVillage` replacing
  `removeVillageMember`.
- `packages/i18n/messages/es.json` — add leave-dialog keys under `profile.personForm`.
- `apps/mobile/app/person/[personId].tsx` — swap `MembershipBarrioList` for
  `MembershipVillageEditor`.
- `CHANGELOG.md` — note under `[Unreleased]`.

**Create:**

- `apps/mobile/components/feature/MembershipVillageEditor.tsx` — the new own-profile
  editor.
- `apps/mobile/components/feature/__tests__/MembershipVillageEditor.test.tsx` — jest.
- `packages/shared/test/villageMemberService.leaveVillage.test.ts` — vitest.

**Delete:**

- `apps/mobile/components/feature/MembershipBarrioList.tsx` (superseded).
- Its test file if one exists.

## Interfaces (locked signatures)

- `leaveVillage(municipalityId: string, userId: string): Promise<void>` — new.
- `ensureVillageMembership(municipalityId: string, userId: string, barrioId?: string | null): Promise<void>` — existing.
- `updateResidenceBarrio(userId: string, municipalityId: string, barrioId: string | null): Promise<void>` — existing.
- `getUserMemberships(userId: string): Promise<UserMembership[]>` where `UserMembership = { municipalityId; role; joinedAt: Date; profileCompletedAt: Date | null }` — existing.
- `setActiveMunicipality(userId: string, municipalityId: string | null): Promise<void>` — existing.
- `getMunicipality`, `getPersonByUserId`, `escudoThumbDisplayUrl` — existing.

---

# Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the own-profile residence step add-village (= join), per-village barrio, and leave-village (confirmed) behaviour.

**Architecture:** New mobile `MembershipVillageEditor` backed by existing atomic `joinVillage`/`updateResidenceBarrio` plus a new atomic `leaveVillage`. No data-model or rules change.

**Tech Stack:** Expo/React Native, NativeWind, `@cultuvilla/shared` services, Firestore client SDK, vitest (shared) + jest (mobile).

## Global Constraints

- Every residence-link write constructs its entry via `buildResidenceLinks` (exact `{municipalityId, barrioId}` shape — the `array-contains` censo query silently drops mis-shaped entries).
- No component imports `firebase/*` directly — all Firebase access via services.
- Confirmation dialogs branch on `Platform.OS === 'web'` (`window.confirm`) because `Alert.alert` is a no-op on the web build.
- User-facing strings go through `useT()`; add keys to `packages/i18n/messages/es.json`.
- Strict TypeScript, no `any`.

---

### Task 1: `leaveVillage` atomic batch (shared service)

**Files:**
- Modify: `packages/shared/src/services/villageMemberService.ts` (replace `removeVillageMember`, lines 118-123)
- Test: `packages/shared/test/villageMemberService.leaveVillage.test.ts`

**Interfaces:**
- Produces: `leaveVillage(municipalityId: string, userId: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { commitMock, deleteMock, updateMock } = vi.hoisted(() => ({
  commitMock: vi.fn().mockResolvedValue(undefined),
  deleteMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  writeBatch: () => ({ delete: deleteMock, update: updateMock, commit: commitMock }),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  deleteDoc: vi.fn(),
  collectionGroup: vi.fn(),
  where: vi.fn(),
  query: vi.fn(),
}));
vi.mock('../src/firebase', () => ({ getDb: () => ({}), getFirebaseFunctions: () => ({}) }));
vi.mock('../src/firebase/refs/client', () => ({
  municipalityMembersCollection: vi.fn(),
  municipalityMemberDoc: (_db: unknown, m: string, u: string) => ({ path: `municipalities/${m}/members/${u}` }),
}));
vi.mock('../src/firebase/converters/villageMemberConverter.client', () => ({ villageMemberConverterClient: {} }));
vi.mock('../src/services/userService', () => ({ setActiveMunicipality: vi.fn() }));
vi.mock('../src/services/municipalityService', () => ({ getMunicipality: vi.fn(), startVillage: vi.fn() }));

const getPersonByUserId = vi.fn();
vi.mock('../src/services/personService', () => ({ getPersonByUserId: (...a: unknown[]) => getPersonByUserId(...a) }));

import { leaveVillage } from '../src/services/villageMemberService';

describe('leaveVillage', () => {
  beforeEach(() => {
    commitMock.mockClear();
    deleteMock.mockClear();
    updateMock.mockClear();
    getPersonByUserId.mockReset();
  });

  it('deletes the member doc and strips the residence link in one batch', async () => {
    getPersonByUserId.mockResolvedValue({
      id: 'p1',
      municipalityLinks: [
        { municipalityId: 'm1', barrioId: 'b1' },
        { municipalityId: 'm2', barrioId: null },
      ],
    });

    await leaveVillage('m1', 'u1');

    expect(deleteMock).toHaveBeenCalledWith({ path: 'municipalities/m1/members/u1' });
    expect(updateMock).toHaveBeenCalledWith(
      { path: 'persons/p1' },
      { municipalityLinks: [{ municipalityId: 'm2', barrioId: null }] },
    );
    expect(commitMock).toHaveBeenCalledTimes(1);
  });

  it('deletes only the member doc when the caller has no person', async () => {
    getPersonByUserId.mockResolvedValue(null);
    await leaveVillage('m1', 'u1');
    expect(deleteMock).toHaveBeenCalledWith({ path: 'municipalities/m1/members/u1' });
    expect(updateMock).not.toHaveBeenCalled();
    expect(commitMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/villageMemberService.leaveVillage.test.ts`
Expected: FAIL — `leaveVillage` is not exported.

- [ ] **Step 3: Replace `removeVillageMember` with `leaveVillage`**

In `villageMemberService.ts`, delete the `removeVillageMember` function (lines 118-123) and add:

```ts
/**
 * Self-leave a village. Membership and residence are two docs, both
 * owner-writable, so the member delete and the residence-link removal go in one
 * atomic `writeBatch` — no eventual-consistency window. The delete-trigger
 * `syncMemberBarrioToResidence` still fires on the member delete but finds the
 * link already gone (idempotent no-op). Caller reassigns `activeMunicipalityId`.
 */
export async function leaveVillage(municipalityId: string, userId: string): Promise<void> {
  const db = getDb();
  const person = await getPersonByUserId(userId);

  const batch = writeBatch(db);
  batch.delete(municipalityMemberDoc(db, municipalityId, userId));
  if (person) {
    const remaining = person.municipalityLinks.filter((l) => l.municipalityId !== municipalityId);
    // Raw doc ref: batch.update takes field paths, bypassing the converter.
    batch.update(doc(db, 'persons', person.id), { municipalityLinks: remaining });
  }
  await batch.commit();
}
```

(`getPersonByUserId`, `doc`, `writeBatch`, `municipalityMemberDoc` are already imported.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/villageMemberService.leaveVillage.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck the workspace**

Run: `pnpm typecheck`
Expected: PASS (confirms no dangling `removeVillageMember` reference — it had no callers).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/services/villageMemberService.ts packages/shared/test/villageMemberService.leaveVillage.test.ts
git commit -m "feat(shared): add leaveVillage atomic self-leave batch"
```

---

### Task 2: Leave-dialog i18n keys

**Files:**
- Modify: `packages/i18n/messages/es.json` (`profile.personForm`, after line 671)

- [ ] **Step 1: Add the keys**

Change the `personForm` block's tail so `removeVillage` is followed by the leave-dialog keys:

```json
      "addVillage": "Añadir pueblo",
      "removeVillage": "Quitar",
      "leaveVillageTitle": "Salir del pueblo",
      "leaveVillageMessage": "Dejarás de ver el contenido de este pueblo y de aparecer en su censo. Puedes volver a unirte cuando quieras.",
      "leaveVillageConfirm": "Salir",
      "leaveVillageCancel": "Cancelar",
      "leavingVillage": "Saliendo del pueblo…"
```

- [ ] **Step 2: Verify JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/i18n/messages/es.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "feat(i18n): add leave-village dialog strings"
```

---

### Task 3: `MembershipVillageEditor` component

**Files:**
- Create: `apps/mobile/components/feature/MembershipVillageEditor.tsx`
- Test: `apps/mobile/components/feature/__tests__/MembershipVillageEditor.test.tsx`

**Interfaces:**
- Consumes: `leaveVillage`, `ensureVillageMembership`, `getUserMemberships` (villageMemberService); `getPersonByUserId`, `updateResidenceBarrio` (personService); `getMunicipality` (municipalityService); `setActiveMunicipality` (userService); `useAuth` for `profile.activeMunicipalityId`.
- Produces: `MembershipVillageEditor({ userId }: { userId: string })`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MembershipVillageEditor } from '../MembershipVillageEditor';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ t: (k: string) => k }) }));
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({ profile: { activeMunicipalityId: 'm1' } }),
}));

const getUserMemberships = jest.fn();
const leaveVillage = jest.fn().mockResolvedValue(undefined);
const ensureVillageMembership = jest.fn().mockResolvedValue(undefined);
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  getUserMemberships: (...a: unknown[]) => getUserMemberships(...a),
  leaveVillage: (...a: unknown[]) => leaveVillage(...a),
  ensureVillageMembership: (...a: unknown[]) => ensureVillageMembership(...a),
}));
const getPersonByUserId = jest.fn();
const updateResidenceBarrio = jest.fn().mockResolvedValue(undefined);
jest.mock('@cultuvilla/shared/services/personService', () => ({
  getPersonByUserId: (...a: unknown[]) => getPersonByUserId(...a),
  updateResidenceBarrio: (...a: unknown[]) => updateResidenceBarrio(...a),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipality: jest.fn().mockResolvedValue({ name: 'Villa Uno' }),
}));
const setActiveMunicipality = jest.fn().mockResolvedValue(undefined);
jest.mock('@cultuvilla/shared/services/userService', () => ({
  setActiveMunicipality: (...a: unknown[]) => setActiveMunicipality(...a),
}));
jest.mock('@cultuvilla/shared/models/municipality', () => ({ escudoThumbDisplayUrl: () => null }));

beforeEach(() => {
  getUserMemberships.mockReset();
  getPersonByUserId.mockReset();
  leaveVillage.mockClear();
  setActiveMunicipality.mockClear();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});

it('renders one leave button per joined village', async () => {
  getUserMemberships.mockResolvedValue([{ municipalityId: 'm1', role: 'user', joinedAt: new Date(), profileCompletedAt: null }]);
  getPersonByUserId.mockResolvedValue({ municipalityLinks: [{ municipalityId: 'm1', barrioId: null }] });
  const { getAllByLabelText } = render(<MembershipVillageEditor userId="u1" />);
  await waitFor(() => expect(getAllByLabelText('profile.personForm.removeVillage')).toHaveLength(1));
});

it('leaves the village and reassigns active on confirm', async () => {
  getUserMemberships.mockResolvedValue([
    { municipalityId: 'm1', role: 'user', joinedAt: new Date(), profileCompletedAt: null },
    { municipalityId: 'm2', role: 'user', joinedAt: new Date(), profileCompletedAt: null },
  ]);
  getPersonByUserId.mockResolvedValue({ municipalityLinks: [] });
  const { getAllByLabelText } = render(<MembershipVillageEditor userId="u1" />);
  await waitFor(() => expect(getAllByLabelText('profile.personForm.removeVillage').length).toBe(2));
  fireEvent.press(getAllByLabelText('profile.personForm.removeVillage')[0]);
  await waitFor(() => expect(leaveVillage).toHaveBeenCalledWith('m1', 'u1'));
  // m1 was active → reassign to the remaining membership.
  await waitFor(() => expect(setActiveMunicipality).toHaveBeenCalledWith('u1', 'm2'));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter cultuvilla-mobile exec jest MembershipVillageEditor`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `apps/mobile/components/feature/MembershipVillageEditor.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  VStack,
  HStack,
  Text,
  Pressable,
  Escudo,
  FieldLabel,
  VillagePicker,
  BarrioPicker,
} from '../primitives';
import { useT } from '../../lib/i18n';
import { useAuth } from '../../lib/auth/useAuth';
import {
  getUserMemberships,
  ensureVillageMembership,
  leaveVillage,
} from '@cultuvilla/shared/services/villageMemberService';
import { getPersonByUserId, updateResidenceBarrio } from '@cultuvilla/shared/services/personService';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { setActiveMunicipality } from '@cultuvilla/shared/services/userService';
import { escudoThumbDisplayUrl } from '@cultuvilla/shared/models/municipality';

interface Row {
  municipalityId: string;
  name: string;
  escudoThumbUrl: string | null;
  barrioId: string | null;
}

export interface MembershipVillageEditorProps {
  /** The account whose villages are edited (the caller's own uid). */
  userId: string;
}

/**
 * Own-profile village + barrio editor. Rows are the caller's memberships; each
 * carries a fixed village header (no swapping) and an editable barrio. Adding a
 * village joins it (`ensureVillageMembership`, dormant-safe); removing one leaves
 * it (confirmed `leaveVillage` batch) and reassigns `activeMunicipalityId` when
 * the active village is the one left. Residence barrio is single-source-of-truth
 * on `municipalityLinks` (`updateResidenceBarrio`).
 */
export function MembershipVillageEditor({ userId }: MembershipVillageEditorProps) {
  const { t } = useT();
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [memberships, person] = await Promise.all([
      getUserMemberships(userId),
      getPersonByUserId(userId),
    ]);
    const links = person?.municipalityLinks ?? [];
    const named = await Promise.all(
      memberships.map(async (m) => {
        const muni = await getMunicipality(m.municipalityId);
        const link = links.find((l) => l.municipalityId === m.municipalityId);
        return {
          municipalityId: m.municipalityId,
          name: muni?.name ?? m.municipalityId,
          escudoThumbUrl: muni ? escudoThumbDisplayUrl(muni) : null,
          barrioId: link?.barrioId ?? null,
        };
      }),
    );
    named.sort((a, b) => a.name.localeCompare(b.name));
    setRows(named);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await load();
      if (cancelled) setRows(null);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function onChangeBarrio(municipalityId: string, barrioId: string | null) {
    setRows((prev) =>
      (prev ?? []).map((r) => (r.municipalityId === municipalityId ? { ...r, barrioId } : r)),
    );
    await updateResidenceBarrio(userId, municipalityId, barrioId);
  }

  async function onAddVillage(municipalityId: string | null) {
    if (!municipalityId || busy) return;
    setBusy(true);
    try {
      await ensureVillageMembership(municipalityId, userId);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function doLeave(municipalityId: string) {
    setBusy(true);
    try {
      await leaveVillage(municipalityId, userId);
      const remaining = (rows ?? []).filter((r) => r.municipalityId !== municipalityId);
      if (profile?.activeMunicipalityId === municipalityId) {
        await setActiveMunicipality(userId, remaining[0]?.municipalityId ?? null);
      }
      setRows(remaining);
    } finally {
      setBusy(false);
    }
  }

  function confirmLeave(municipalityId: string) {
    // Alert.alert is a no-op on RN-Web, so branch to window.confirm there.
    if (Platform.OS === 'web') {
      if (window.confirm(t('profile.personForm.leaveVillageMessage'))) void doLeave(municipalityId);
      return;
    }
    Alert.alert(
      t('profile.personForm.leaveVillageTitle'),
      t('profile.personForm.leaveVillageMessage'),
      [
        { text: t('profile.personForm.leaveVillageCancel'), style: 'cancel' },
        {
          text: t('profile.personForm.leaveVillageConfirm'),
          style: 'destructive',
          onPress: () => void doLeave(municipalityId),
        },
      ],
    );
  }

  if (rows === null) {
    return (
      <View className="py-4 items-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <VStack gap={3}>
      <FieldLabel>{t('profile.personForm.myVillagesHeading')}</FieldLabel>
      {rows.length === 0 ? (
        <Text tone="muted" variant="bodySm">
          {t('profile.personForm.noVillages')}
        </Text>
      ) : (
        rows.map((r) => (
          <VStack key={r.municipalityId} gap={1} className="rounded-md border border-subtle p-3">
            <HStack className="items-center justify-between">
              <HStack gap={2} className="items-center">
                <Escudo url={r.escudoThumbUrl} size={28} fallbackInitial={r.name} />
                <Text className="font-semibold">{r.name}</Text>
              </HStack>
              <Pressable
                onPress={() => confirmLeave(r.municipalityId)}
                disabled={busy}
                accessibilityLabel={t('profile.personForm.removeVillage')}
                hitSlop={8}
                className="flex-row items-center p-1"
              >
                <Ionicons name="exit-outline" size={16} color="#dc2626" />
                <Text variant="bodySm" tone="danger" className="ml-1">
                  {t('profile.personForm.removeVillage')}
                </Text>
              </Pressable>
            </HStack>
            <BarrioPicker
              label={t('profile.personForm.barrio')}
              municipalityId={r.municipalityId}
              value={r.barrioId}
              onChange={(barrioId) => void onChangeBarrio(r.municipalityId, barrioId)}
              wholeVillageLabel={t('profile.personForm.wholeVillage')}
            />
          </VStack>
        ))
      )}
      <VillagePicker
        label={t('profile.personForm.addVillage')}
        value={null}
        onChange={(id) => void onAddVillage(id)}
      />
    </VStack>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile exec jest MembershipVillageEditor`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feature/MembershipVillageEditor.tsx apps/mobile/components/feature/__tests__/MembershipVillageEditor.test.tsx
git commit -m "feat(mobile): add MembershipVillageEditor (add/leave own villages)"
```

---

### Task 4: Wire the editor in, delete `MembershipBarrioList`

**Files:**
- Modify: `apps/mobile/app/person/[personId].tsx` (import line 9; usage line 228)
- Delete: `apps/mobile/components/feature/MembershipBarrioList.tsx` (+ its test if present)

- [ ] **Step 1: Swap the import and usage**

In `app/person/[personId].tsx`, replace the import on line 9:

```tsx
import { MembershipVillageEditor } from '../../components/feature/MembershipVillageEditor';
```

and the render on line 228:

```tsx
              <MembershipVillageEditor userId={user.uid} />
```

- [ ] **Step 2: Delete the superseded component**

```bash
git rm apps/mobile/components/feature/MembershipBarrioList.tsx
ls apps/mobile/components/feature/__tests__/MembershipBarrioList.test.tsx 2>/dev/null && git rm apps/mobile/components/feature/__tests__/MembershipBarrioList.test.tsx || true
```

- [ ] **Step 3: Typecheck + run the mobile suite**

Run: `pnpm app:typecheck && pnpm --filter cultuvilla-mobile exec jest`
Expected: PASS, no reference to `MembershipBarrioList`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/person/[personId].tsx
git commit -m "refactor(mobile): use MembershipVillageEditor on own profile; drop MembershipBarrioList"
```

---

### Task 5: Docs

**Files:**
- Modify: `packages/shared/src/services/_services-map.md`, `CHANGELOG.md`

- [ ] **Step 1: Update the services map**

In `_services-map.md`, in the `villageMemberService` row, change `removeVillageMember` in the exports list to `leaveVillage`, and update the prose to describe `leaveVillage` as the atomic self-leave batch (delete member + strip residence link).

- [ ] **Step 2: Add a CHANGELOG entry**

Under `## [Unreleased]`, add:

```md
- Own profile: add and leave your villages (with confirmation) directly from the profile editor, and set a barrio per village — matching the persona residence editor.
```

- [ ] **Step 3: Run the full gate**

Run: `pnpm check`
Expected: PASS (lint + typecheck + test + build). Hand any emulator-only suites to the user per AGENTS.md.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/services/_services-map.md CHANGELOG.md
git commit -m "docs: note leaveVillage + own-profile village editor"
```
