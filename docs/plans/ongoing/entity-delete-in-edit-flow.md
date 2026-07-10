# Delete moves out of detail headers, into edit flows

**Goal:** For every entity, the delete affordance lives as a `trash` icon in the
entity's **edit-screen header** — never in the entity **detail** header.

## Status

- **Updated:** 2026-07-10
- **Stage:** Task 1 — `DeleteHeaderButton` component
- **Branch:** repo `feat/delete-in-edit-flow` (worktree `.claude/worktrees/delete-in-edit-flow`)
- **Done:** spec + full task plan written
- **Next:** implement Task 1 (component + test)
- **Blockers:** Task 2 rules e2e + Task 8 `pnpm check` need the user's Firebase emulators running
- **Handoff:** commit from inside the worktree (`cd` first, verify `git branch --show-current` = `feat/delete-in-edit-flow`); base checkout stays on `develop`. Dev rules deploy (news delete) is a post-merge/PR step via the `firestore-deploy` skill.

## Context

Today the delete UX is inconsistent:

- **event** is the only entity with a delete in its *detail* header — a
  `trash-outline` action that actually *cancels* the event
  (`updateEventStatus(id, 'cancelled')`, a soft transition, not a hard delete).
- **news** has no delete affordance anywhere.
- **place / barrio / org / festival-poster** are deletable only from inside their
  village-management "manager" list (`ProposableListItem` `onDelete`), not from
  the entity's own detail or edit screen.

The user's directive: delete should not sit in the detail header "in the first
place" — it belongs in the edit flow, surfaced as a header icon. This unifies the
pattern across all entities.

## Design / approach

**Principle:** delete is a `trash` icon in each entity's **edit-screen
`ScreenHeader` `rightSlot`**, shown only to a user who can manage that entity,
always behind a confirm dialog. It is removed from (and never added to) the entity
*detail* header.

Every edit surface already renders `ScreenHeader`, which exposes a `rightSlot` —
so the icon lands cleanly with no header-layout changes.

### Confirm dialog + web branch

`Alert.alert` is a no-op on the RN-Web build (see the `mobile-web-compat` skill /
memory). The reusable delete button must branch to `window.confirm` on
`Platform.OS === 'web'`, mirroring the existing pattern in
[event/[eventId].tsx:88-96](apps/mobile/app/event/[eventId].tsx#L88-L96).

### Reusable component

Add `apps/mobile/components/feature/DeleteHeaderButton.tsx`: a `trash-outline`
`HeaderIconButton` that runs a confirm dialog (native `Alert` + web
`window.confirm`) and calls `onConfirm` on accept. Props: `onConfirm`,
`confirmTitle`, `confirmMessage`, `confirmLabel`, `accessibilityLabel`, optional
`busy`. Consumed via `ScreenHeader`'s `rightSlot`.

### Per-entity changes

| Entity | Change | Delete action | Gate |
|---|---|---|---|
| **event** | Remove `trash` from detail header; add `DeleteHeaderButton` to the edit stepper's `ScreenHeader` (edit mode only) | `updateEventStatus(id, 'cancelled')` — **framed as delete (trash icon + "delete" label), soft-cancel in practice** | `canOrganize` (existing `useEventOrganizer`) |
| **news** | Add `DeleteHeaderButton` to the edit stepper's `ScreenHeader` (edit mode only) | **new** `deleteNewsPost(id)` — hard delete | author **or** village-admin **or** app-admin |
| **place** | Add `DeleteHeaderButton` to `place/[placeId]/edit.tsx` header | `deletePlace(villageId, placeId)` | `canManage` (existing) |
| **barrio** | Add `DeleteHeaderButton` to `barrio/[barrioId]/edit.tsx` header | `deleteBarrio(villageId, barrioId)` | `canManage` |
| **org** | Add `DeleteHeaderButton` to `o/[orgId]/edit.tsx` header | `deleteOrganization(orgId)` | `canManage` |
| **festival-poster** | **Build a new edit screen** `festival-poster/[posterId]/edit.tsx`; add `DeleteHeaderButton` to its header; add a `create-outline` edit action to the poster *detail* header | `deleteFestivalPoster(posterId)` | `canManage` |

After a successful delete the screen navigates back to a sane landing spot
(`router.back()` / `router.replace` to the parent list), never to the now-deleted
entity's detail.

### News: new `deleteNewsPost` service + rule

- Add `deleteNewsPost(postId)` to `newsService.ts` (plain `deleteDoc(newsDoc(...))`,
  mirroring the existing `deleteEvent`).
- Enforce the gate in `firestore.rules`. The current `match /news/{postId}` has
  `allow delete: if false;` ([firestore.rules:459](firestore.rules#L459)); replace
  with:

  ```
  allow delete: if isOwner(resource.data.createdBy)
                || isVillageAdmin(resource.data.municipalityId)
                || isAppAdmin();
  ```

  All three helpers already exist. No callable needed (rule-backed guardrail — the
  gate is expressible in rules, so this is the correct layer per
  `guardrail-enforcement`).
- The rules deploy is dev-only via the `firestore-deploy` skill (user-driven;
  beta/prod via CI).

### Festival-poster edit screen

New file `apps/mobile/app/village/[villageId]/festival-poster/[posterId]/edit.tsx`,
modeled on `place/[placeId]/edit.tsx`:

- `useEntityCapabilities(villageId)` → redirect non-managers to the detail.
- Load via `getFestivalPoster(posterId)`; prefill year / title / start / end / image.
- Reuse the field set + `datesToPayload` logic from `FestivalPostersManager`
  (extract the year-sanitize + dates helpers to a shared module rather than
  duplicating).
- Save via `updateFestivalPoster` (+ `uploadFestivalPosterImage` if the image
  changed).
- `DeleteHeaderButton` in the header → `deleteFestivalPoster` → back to the village.
- Wire the poster *detail* screen's header to a `create-outline` edit action
  routing here (it currently has no actions at all).

### i18n

Add strings under each entity's namespace for the delete confirm title/message and
the trash accessibility label. Reuse `common.delete` / `common.cancel` where they
already exist.

## File Structure

**Create**
- `apps/mobile/components/feature/DeleteHeaderButton.tsx` — reusable trash icon + confirm dialog for `ScreenHeader` `rightSlot`.
- `apps/mobile/components/feature/__tests__/DeleteHeaderButton.test.tsx`
- `apps/mobile/app/village/[villageId]/festival-poster/[posterId]/edit.tsx` — new poster edit screen.
- `apps/mobile/app/village/[villageId]/festival-poster/__tests__/edit.test.tsx`
- `apps/mobile/components/feature/proposable/festivalPosterForm.ts` — extracted `sanitizeYear` + `datesToPayload` (shared by manager + new edit screen).

**Modify**
- `apps/mobile/app/event/[eventId].tsx` — remove the `trash` action from the detail header.
- `apps/mobile/app/event/new.tsx` — add `DeleteHeaderButton` to the edit stepper's `ScreenHeader` (edit mode).
- `apps/mobile/app/news/new.tsx` — add `DeleteHeaderButton` to the edit stepper's `ScreenHeader` (edit mode). (`news/[newsId].tsx` detail stays clean — no change.)
- `apps/mobile/app/village/[villageId]/place/[placeId]/edit.tsx`, `.../barrio/[barrioId]/edit.tsx`, `apps/mobile/app/o/[orgId]/edit.tsx` — add `DeleteHeaderButton`.
- `apps/mobile/app/village/[villageId]/festival-poster/[posterId].tsx` — add a `create-outline` edit action to the detail header.
- `apps/mobile/components/feature/proposable/FestivalPostersManager.tsx` — consume the extracted helpers.
- `packages/shared/src/services/newsService.ts` — add `deleteNewsPost`; `_services-map.md` — document it.
- `firestore.rules` — news `allow delete` gate; `packages/shared/test/e2e/newsRules.test.ts` — delete-gate cases.
- `packages/i18n/messages/es.json`, `CHANGELOG.md`.

## Resolved decisions

- **Both delete paths coexist.** The village-management manager lists
  (`PlacesManager`, etc.) keep their existing per-item delete; the edit screen
  *adds* a second delete affordance. Different surfaces, different audiences (bulk
  moderation vs. single-entity edit). No manager-list code is removed.
- **Event is framed as delete, soft in practice.** The event edit-header button
  uses the `trash` icon and "delete" label (visual parity with the other
  entities) but calls `updateEventStatus(id, 'cancelled')` under the hood — the
  event is soft-cancelled, registrations/history preserved. No hard `deleteEvent`
  from this surface.

---

# Delete-in-edit-flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the delete affordance out of entity detail headers into each entity's edit-screen header, as a management-gated `trash` icon behind a confirm dialog.

**Architecture:** One reusable `DeleteHeaderButton` (native `Alert` + web `window.confirm`) dropped into every edit screen's `ScreenHeader` `rightSlot`. News gains a rule-backed `deleteNewsPost`; festival-poster gains a real edit screen. Event keeps soft-cancel semantics under a "delete" label.

**Tech Stack:** Expo SDK 54 / Expo Router v4 / RN, NativeWind v4, `@cultuvilla/shared` services, Firestore rules, vitest (`packages/shared`) + jest (`apps/mobile`).

## Global Constraints

- Worktree path: `/home/powervaro/githubs/cultuvilla/.claude/worktrees/delete-in-edit-flow`, branch `feat/delete-in-edit-flow`. All commits here; base checkout stays on `develop`. Subagents run in the primary checkout — `cd` into the worktree and confirm `git branch --show-current` before committing.
- `Alert.alert` is a no-op on RN-Web — every confirm MUST branch to `window.confirm` on `Platform.OS === 'web'`.
- Icon sizes from `iconSizes` (`@cultuvilla/shared/design-system`); no ad-hoc numeric `size=`.
- User-facing strings through `useT()`, added to `packages/i18n/messages/es.json`.
- Components must not import `firebase/*` — go through a service.
- `ScreenHeader accent` bars are orange: header icons use light tint `#f9f0e8` (`onAccent`); neutral headers use `colors.light.fg.accent`.
- Strict TS, no `any`. Per-task gate: `pnpm app:typecheck` + targeted `jest` (mobile) / `pnpm --filter @cultuvilla/shared test` (shared). Full `pnpm check` before PR. Don't boot emulators — the rules e2e run (Task 2) needs the user's emulators; hand that run over if not already up.

---

### Task 1: `DeleteHeaderButton` component

**Files:** Create `apps/mobile/components/feature/DeleteHeaderButton.tsx`; Test `apps/mobile/components/feature/__tests__/DeleteHeaderButton.test.tsx`.

**Interfaces — Produces:** `DeleteHeaderButton(props: { onConfirm: () => void; accessibilityLabel: string; confirmTitle: string; confirmMessage: string; confirmLabel: string; cancelLabel: string; onAccent?: boolean })`.

- [ ] **Step 1: Failing test**

```tsx
// apps/mobile/components/feature/__tests__/DeleteHeaderButton.test.tsx
import { fireEvent, render } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';
import { DeleteHeaderButton } from '../DeleteHeaderButton';

const props = { accessibilityLabel: 'Eliminar', confirmTitle: 'Eliminar', confirmMessage: '¿Seguro?', confirmLabel: 'Eliminar', cancelLabel: 'Cancelar' };

describe('DeleteHeaderButton', () => {
  it('native: fires onConfirm when the destructive Alert button is pressed', () => {
    Platform.OS = 'ios';
    const onConfirm = jest.fn();
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, btns) => {
      btns?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    const { getByLabelText } = render(<DeleteHeaderButton {...props} onConfirm={onConfirm} />);
    fireEvent.press(getByLabelText('Eliminar'));
    expect(spy).toHaveBeenCalledWith('Eliminar', '¿Seguro?', expect.any(Array));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('web: fires onConfirm only when window.confirm returns true', () => {
    Platform.OS = 'web';
    const onConfirm = jest.fn();
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const { getByLabelText } = render(<DeleteHeaderButton {...props} onConfirm={onConfirm} />);
    fireEvent.press(getByLabelText('Eliminar'));
    expect(onConfirm).not.toHaveBeenCalled();
    confirmSpy.mockReturnValue(true);
    fireEvent.press(getByLabelText('Eliminar'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter cultuvilla-mobile exec jest DeleteHeaderButton` → FAIL (module not found).

- [ ] **Step 3: Implement**

```tsx
// apps/mobile/components/feature/DeleteHeaderButton.tsx
import { Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from '../primitives/Pressable';
import { colors, iconSizes } from '@cultuvilla/shared/design-system';

export type DeleteHeaderButtonProps = {
  onConfirm: () => void;
  accessibilityLabel: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Rendered inside an orange `ScreenHeader accent` bar → use the light tint. */
  onAccent?: boolean;
};

export function DeleteHeaderButton({
  onConfirm, accessibilityLabel, confirmTitle, confirmMessage, confirmLabel, cancelLabel, onAccent = false,
}: DeleteHeaderButtonProps) {
  // Alert.alert is a no-op on RN-Web, so branch to window.confirm there.
  const run = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) onConfirm();
      return;
    }
    Alert.alert(confirmTitle, confirmMessage, [
      { text: cancelLabel, style: 'cancel' },
      { text: confirmLabel, style: 'destructive', onPress: onConfirm },
    ]);
  };
  return (
    <Pressable onPress={run} accessibilityLabel={accessibilityLabel} className="p-1 ml-2">
      <Ionicons name="trash-outline" size={iconSizes.md} color={onAccent ? '#f9f0e8' : colors.light.fg.accent} />
    </Pressable>
  );
}
```

- [ ] **Step 4: Run to verify it passes** — `pnpm --filter cultuvilla-mobile exec jest DeleteHeaderButton` → PASS.

- [ ] **Step 5: i18n** — add to `common` in `packages/i18n/messages/es.json`: `"deleteConfirmTitle": "Eliminar"`, `"deleteConfirmMessage": "¿Seguro que quieres eliminarlo? Esta acción no se puede deshacer."` (`common.delete`/`common.cancel` already exist).

- [ ] **Step 6: Commit**

```bash
cd /home/powervaro/githubs/cultuvilla/.claude/worktrees/delete-in-edit-flow && git branch --show-current
git add apps/mobile/components/feature/DeleteHeaderButton.tsx apps/mobile/components/feature/__tests__/DeleteHeaderButton.test.tsx packages/i18n/messages/es.json
git commit -m "feat(mobile): add DeleteHeaderButton for edit-screen headers"
```

---

### Task 2: `deleteNewsPost` service + rule-backed delete gate

**Files:** Modify `packages/shared/src/services/newsService.ts`, `firestore.rules` (line 459), `packages/shared/src/services/_services-map.md`; Test `packages/shared/test/e2e/newsRules.test.ts`.

**Interfaces — Produces:** `deleteNewsPost(postId: string): Promise<void>` (gate: author / village-admin / app-admin, enforced by rules).

- [ ] **Step 1: Failing rules tests** — in `newsRules.test.ts`, replace case 8 ("client cannot delete a news post directly") with:

```ts
  it('8: author can delete own post', async () => {
    await seedMember('m1', 'alice');
    await seedPost('p1', 'm1', 'alice');
    await assertSucceeds(deleteDoc(doc(asUser(getEnv(), 'alice'), 'news/p1')));
  });
  it('8b: village admin can delete another member\'s post', async () => {
    await seedMember('m1', 'alice');
    await seedMember('m1', 'admin', { role: 'admin' });
    await seedPost('p1', 'm1', 'alice');
    await assertSucceeds(deleteDoc(doc(asUser(getEnv(), 'admin'), 'news/p1')));
  });
  it('8c: non-author non-admin member cannot delete', async () => {
    await seedMember('m1', 'alice');
    await seedMember('m1', 'bob');
    await seedPost('p1', 'm1', 'alice');
    await assertFails(deleteDoc(doc(asUser(getEnv(), 'bob'), 'news/p1')));
  });
```

- [ ] **Step 2: Run to verify it fails** (emulators up — ask the user if not) — `pnpm --filter @cultuvilla/shared test -- newsRules` → 8 and 8b FAIL.

- [ ] **Step 3: Update the rule** — in `firestore.rules`, replace `allow delete: if false;` in `match /news/{postId}`:

```
      allow delete: if isOwner(resource.data.createdBy)
                    || isVillageAdmin(resource.data.municipalityId)
                    || isAppAdmin();
```

- [ ] **Step 4: Add the service** — in `newsService.ts` (`deleteDoc`, `newsDoc`, `getDb` already imported):

```ts
/** Hard-delete a news post. Gate (author / village-admin / app-admin) is
 * enforced by firestore.rules on /news/{postId}. */
export async function deleteNewsPost(postId: string): Promise<void> {
  await deleteDoc(newsDoc(getDb(), postId));
}
```

- [ ] **Step 5: Run to verify it passes** — `pnpm --filter @cultuvilla/shared test -- newsRules` → PASS.

- [ ] **Step 6: Document + commit** — add a `deleteNewsPost` row to `_services-map.md`.

```bash
cd /home/powervaro/githubs/cultuvilla/.claude/worktrees/delete-in-edit-flow && git branch --show-current
git add packages/shared/src/services/newsService.ts firestore.rules packages/shared/test/e2e/newsRules.test.ts packages/shared/src/services/_services-map.md
git commit -m "feat(news): allow author/admin hard-delete of a news post (rule-backed)"
```

> Rules deploy to dev is user-driven via the `firestore-deploy` skill; note it in the PR test plan.

---

### Task 3: event — move delete into the edit stepper header

**Files:** Modify `apps/mobile/app/event/[eventId].tsx`, `apps/mobile/app/event/new.tsx`.
**Interfaces — Consumes:** `DeleteHeaderButton` (T1); `updateEventStatus(id, 'cancelled')` (existing).

- [ ] **Step 1: Remove trash from detail header** — in `[eventId].tsx`, delete the `trash-outline` action object and the `cancelEvent` handler; drop now-unused imports (`updateEventStatus`, and `Alert`/`Platform` if unused elsewhere). Keep `create-outline` + `share-outline`.

- [ ] **Step 2: Add to edit stepper header** — in `new.tsx`, import `DeleteHeaderButton` + `updateEventStatus`; add handler + `rightSlot` on the final `<ScreenHeader accent title={headerTitle} />` (above `<KeyboardAvoidingView>`). Reaching edit implies `canOrganize`, so gate on `editMode`:

```tsx
const deleteEvent = () => {
  if (!eventId) return;
  void updateEventStatus(eventId, 'cancelled').then(() => router.replace(`/event/${eventId}`));
};
// rightSlot on the final ScreenHeader:
rightSlot={editMode ? (
  <DeleteHeaderButton onAccent onConfirm={deleteEvent}
    accessibilityLabel={t('common.delete')} confirmTitle={t('event.cancelTitle')}
    confirmMessage={t('event.cancelConfirm')} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')} />
) : undefined}
```

- [ ] **Step 3: Typecheck + test** — `pnpm app:typecheck && pnpm --filter cultuvilla-mobile exec jest event` → PASS.

- [ ] **Step 4: Commit**

```bash
cd /home/powervaro/githubs/cultuvilla/.claude/worktrees/delete-in-edit-flow && git branch --show-current
git add "apps/mobile/app/event/[eventId].tsx" apps/mobile/app/event/new.tsx
git commit -m "feat(event): move delete out of detail header into edit stepper (soft-cancel)"
```

---

### Task 4: news — add delete to the edit stepper header

**Files:** Modify `apps/mobile/app/news/new.tsx`.
**Interfaces — Consumes:** `DeleteHeaderButton` (T1); `deleteNewsPost` (T2).

- [ ] **Step 1: Wire it** — import `DeleteHeaderButton` + `deleteNewsPost`; add `rightSlot` on the final (form) `<ScreenHeader title={headerTitle} />` (non-accent, omit `onAccent`). Gate on `editMode`. Leave the loading / needs-membership / submitted early-return headers bare.

```tsx
const remove = () => { if (!newsId) return; void deleteNewsPost(newsId).then(() => router.replace('/(tabs)')); };
// rightSlot:
rightSlot={editMode ? (
  <DeleteHeaderButton onConfirm={remove}
    accessibilityLabel={t('common.delete')} confirmTitle={t('common.deleteConfirmTitle')}
    confirmMessage={t('common.deleteConfirmMessage')} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')} />
) : undefined}
```

- [ ] **Step 2: Typecheck + test** — `pnpm app:typecheck && pnpm --filter cultuvilla-mobile exec jest news` → PASS.

- [ ] **Step 3: Commit**

```bash
cd /home/powervaro/githubs/cultuvilla/.claude/worktrees/delete-in-edit-flow && git branch --show-current
git add apps/mobile/app/news/new.tsx
git commit -m "feat(news): add delete to the article edit stepper header"
```

---

### Task 5: place / barrio / org edit-screen delete

**Files:** Modify `.../place/[placeId]/edit.tsx`, `.../barrio/[barrioId]/edit.tsx`, `apps/mobile/app/o/[orgId]/edit.tsx`.
**Interfaces — Consumes:** `DeleteHeaderButton` (T1); `deletePlace(villageId, placeId)`, `deleteBarrio(villageId, barrioId)`, `deleteOrganization(orgId)` (existing).

- [ ] **Step 1: place** — import `DeleteHeaderButton` + `deletePlace`. On the **final** (loaded) `<ScreenHeader accent .../>` add `rightSlot`:

```tsx
rightSlot={
  <DeleteHeaderButton onAccent
    onConfirm={() => { if (villageId && placeId) void deletePlace(villageId, placeId).then(() => router.replace(`/village/${villageId}`)); }}
    accessibilityLabel={t('common.delete')} confirmTitle={t('common.deleteConfirmTitle')}
    confirmMessage={t('common.deleteConfirmMessage')} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')} />
}
```

(Screen already redirects non-managers; loading/not-found early-return headers stay bare.)

- [ ] **Step 2: barrio** — same, `deleteBarrio(villageId, barrioId)` → `router.replace(`/village/${villageId}`)`.
- [ ] **Step 3: org** — same, `deleteOrganization(orgId)` → `router.replace('/(tabs)')`. Confirm the manage gate guards this screen; if it renders for non-admins, wrap `rightSlot` in that gate.
- [ ] **Step 4: Typecheck + tests** — `pnpm app:typecheck && pnpm --filter cultuvilla-mobile exec jest "village|o/__tests__"` → PASS.
- [ ] **Step 5: Commit**

```bash
cd /home/powervaro/githubs/cultuvilla/.claude/worktrees/delete-in-edit-flow && git branch --show-current
git add "apps/mobile/app/village/[villageId]/place/[placeId]/edit.tsx" "apps/mobile/app/village/[villageId]/barrio/[barrioId]/edit.tsx" "apps/mobile/app/o/[orgId]/edit.tsx"
git commit -m "feat(mobile): add edit-screen delete for place, barrio and organization"
```

---

### Task 6: extract shared festival-poster form helpers

**Files:** Create `apps/mobile/components/feature/proposable/festivalPosterForm.ts`; Modify `FestivalPostersManager.tsx`.
**Interfaces — Produces:** `sanitizeYear(text: string): string`; `datesToPayload(startsAt: Date | null, endsAt: Date | null): { datePrecision: DatePrecision; startsAt: Date | null; endsAt: Date | null }`.

- [ ] **Step 1:** move both pure functions (and the `DatePrecision` import) verbatim into `festivalPosterForm.ts` and export them.
- [ ] **Step 2:** delete the local defs in `FestivalPostersManager.tsx`, import from `./festivalPosterForm`.
- [ ] **Step 3: Typecheck + test** — `pnpm app:typecheck && pnpm --filter cultuvilla-mobile exec jest FestivalPostersManager` → PASS.
- [ ] **Step 4: Commit**

```bash
cd /home/powervaro/githubs/cultuvilla/.claude/worktrees/delete-in-edit-flow && git branch --show-current
git add apps/mobile/components/feature/proposable/festivalPosterForm.ts apps/mobile/components/feature/proposable/FestivalPostersManager.tsx
git commit -m "refactor(mobile): extract shared festival-poster form helpers"
```

---

### Task 7: festival-poster edit screen + detail edit action

**Files:** Create `apps/mobile/app/village/[villageId]/festival-poster/[posterId]/edit.tsx`; Test `apps/mobile/app/village/[villageId]/festival-poster/__tests__/edit.test.tsx`; Modify `.../festival-poster/[posterId].tsx`.
**Interfaces — Consumes:** `getFestivalPoster`, `updateFestivalPoster`, `deleteFestivalPoster`, `uploadFestivalPosterImage`, `useEntityCapabilities`, `DeleteHeaderButton` (T1), `sanitizeYear`/`datesToPayload` (T6).

- [ ] **Step 1: Failing screen test**

```tsx
// apps/mobile/app/village/[villageId]/festival-poster/__tests__/edit.test.tsx
import { render, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1', posterId: 'fp1' }),
  router: { replace: jest.fn(), back: jest.fn() },
  Redirect: () => null,
}));
jest.mock('../../../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: () => ({ canManage: true, canApprove: true, uid: 'u1', loading: false }),
}));
jest.mock('@cultuvilla/shared/services/festivalPosterService', () => ({
  getFestivalPoster: jest.fn().mockResolvedValue({
    id: 'fp1', municipalityId: 'm1', year: 2025, title: 'Fiestas',
    imageURL: null, datePrecision: 'year', startsAt: null, endsAt: null, status: 'approved',
  }),
  updateFestivalPoster: jest.fn(), deleteFestivalPoster: jest.fn(),
}));

import PosterEditScreen from '../[posterId]/edit';

it('renders the poster edit form with a delete action', async () => {
  const { getByLabelText, getByDisplayValue } = render(<PosterEditScreen />);
  await waitFor(() => getByDisplayValue('2025'));
  expect(getByLabelText('Eliminar')).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter cultuvilla-mobile exec jest festival-poster/__tests__/edit` → FAIL (module not found).

- [ ] **Step 3: Build the edit screen** — model on `place/[placeId]/edit.tsx`: `useEntityCapabilities(villageId)` (redirect non-managers to the detail), load via `getFestivalPoster`, prefill year/title/dates/image, save via `updateFestivalPoster` (+ `uploadFestivalPosterImage` if a new image was picked), `DeleteHeaderButton` (`onAccent`) in the `ScreenHeader accent` `rightSlot` calling `deleteFestivalPoster(posterId)` → `router.replace(`/village/${villageId}`)`. Reuse `sanitizeYear`/`datesToPayload`; same field set (`Input` year, `Input` title, two `DateField`s, `ImagePickerField`). Add i18n `village.festivalPosters.editTitle` = "Editar cartel".

- [ ] **Step 4: Run to verify it passes** — `pnpm --filter cultuvilla-mobile exec jest festival-poster/__tests__/edit` → PASS.

- [ ] **Step 5: Detail edit action** — in `festival-poster/[posterId].tsx`, add `useEntityCapabilities(villageId)` and pass `actions` to `EntityDetailScaffold` with a `create-outline` action (label `common.edit`) → `router.push(`/village/${villageId}/festival-poster/${posterId}/edit`)` when `canManage`.

- [ ] **Step 6: Typecheck + commit** — `pnpm app:typecheck && pnpm --filter cultuvilla-mobile exec jest festival-poster`

```bash
cd /home/powervaro/githubs/cultuvilla/.claude/worktrees/delete-in-edit-flow && git branch --show-current
git add "apps/mobile/app/village/[villageId]/festival-poster" packages/i18n/messages/es.json
git commit -m "feat(festival-poster): add edit screen with header delete + detail edit action"
```

---

### Task 8: final gate + docs + PR

- [ ] **Step 1: CHANGELOG** — under `## [Unreleased]`: "Delete now lives in each entity's edit-screen header (article/event/place/barrio/organization/festival poster); events soft-cancel."
- [ ] **Step 2: Full check** — `pnpm check` (emulators up for the shared e2e run — ask the user if needed) → PASS.
- [ ] **Step 3: Rebase + PR**

```bash
cd /home/powervaro/githubs/cultuvilla/.claude/worktrees/delete-in-edit-flow
git fetch origin develop && git rebase origin/develop
pnpm check
git push -u origin feat/delete-in-edit-flow
gh pr create --base develop --title "feat: delete moves into entity edit-screen headers" --body "<what/why/tests/test-plan>"
```

- [ ] **Step 4: Deploy dev rules** — use the `firestore-deploy` skill to deploy the news delete rule to dev; note the run in the PR.
