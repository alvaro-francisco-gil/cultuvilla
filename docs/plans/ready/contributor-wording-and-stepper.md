# Contributor wording refresh + stepper creation flows

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reword the "contributors" credit shown on places/carteles de fiestas
around "digitalized by" instead of the generic "contributed", and convert
their two creation screens from a single scrolling form into a multi-step
`Stepper`, matching the pattern already used by `event/new.tsx` and
`news/new.tsx`.

## Context

`feat(entities): add contributor credits` (abd3cac1) added `contributorUserIds`
/ `contributorOrgIds` to places and festival posters, surfaced through a single
shared i18n namespace (`village.contributors.*`) consumed by four screens: the
poster/place detail view (`EntityContributors`), their edit screens, and their
create screens (`FestivalPostersManager`, `PlacesManager`). The wording reads
as generic "contributed" but the actual intent is crediting whoever
photographed/scanned and uploaded the item. Separately, the two creation
screens are still flat scrolling forms while the event and news creation flows
already use the `Stepper` component — this is a chance to bring them in line.

## Design

### 1. Wording (`packages/i18n/messages/es.json`, `village.contributors`)

| Key | Current | New |
|---|---|---|
| `label` | "Contribuyeron" | "Digitalizado por" |
| `peopleLabel` | "Personas colaboradoras" | "Personas que digitalizaron esto" |
| `addPerson` | "Añadir persona" | unchanged |
| `selectPeople` | "Seleccionar personas colaboradoras" | "Seleccionar personas" |

One shared namespace drives all four surfaces (poster/place detail, edit, and
create) — no call sites change, only the message catalog.

### 2. Stepper conversion — creation screens only

Edit screens (`festival-poster/[posterId]/edit.tsx`, `place/[placeId]/edit.tsx`)
are unchanged — they stay flat scrolling forms. Only the two creation screens
(`festival-posters.tsx` → `FestivalPostersManager`, `places.tsx` →
`PlacesManager`) become `Stepper`-driven, following `event/new.tsx`'s shape:
a dedicated date step where a date field exists, attribution always last and
alone.

**Festival poster — 3 steps:**
1. **"Lo básico"** (`create-outline`) — image picker, year, title.
   `validate()`: year is a valid integer and ≥1 image (today's submit-disabled
   condition).
2. **"Fechas"** (`calendar-outline`) — start date, end date. No `validate()`
   (both optional today).
3. **"Digitalización"** (`people-outline`) — `OrganizerPicker` only. No
   `validate()` (optional).

**Place — 2 steps** (no date field to split out):
1. **"Lo básico"** (`create-outline`) — image picker, name, kind chips,
   description. `validate()`: name non-empty (today's submit-disabled
   condition).
2. **"Digitalización"** (`people-outline`) — `OrganizerPicker` only. No
   `validate()`.

New i18n keys: `village.festivalPosters.stepBasics` / `stepDates` /
`stepAttribution`; `village.admin.places.stepBasics` / `stepAttribution`.
Reuse "Lo básico" (existing string elsewhere), add "Fechas", and
"Digitalización" (ties the step name to the new label wording).

### Component-level changes

- `FestivalPostersManager.tsx`: restructure into three `StepConfig` render
  functions wrapped in `Stepper`; `onComplete` calls the existing `submit()`
  unchanged. `festival-posters.tsx` wraps the screen in
  `KeyboardAvoidingView` and sets `bottomInset={false}` on `Screen` (the
  Stepper's own bottom nav bar applies the inset), matching `news/new.tsx`.
- `PlacesManager.tsx`: same treatment (2 steps). It composes `ProposableForm`,
  shared with `BarriosManager`/`AgrupacionesManager` (not being converted), so
  `ProposableForm` gets one new optional prop `hideSubmit?: boolean` (default
  `false`) so the stepper build can omit `ProposableForm`'s built-in submit
  button — the `Stepper` owns the bottom nav bar instead. The two other callers
  are untouched.
- `places.tsx`: same `KeyboardAvoidingView` / `bottomInset={false}` wrapping.

### Testing

- `FestivalPostersManager.test.tsx` / `PlacesManager.test.tsx`: update to step
  through the wizard (press the stepper's "Siguiente"/primary button between
  steps) rather than asserting a flat form, mirroring
  `event/__tests__/new.test.tsx`.
- Any test asserting the old `village.contributors.*` label text is updated to
  the new strings.

### Out of scope

- Edit screens for places/posters (stay flat forms).
- Other proposable managers (Barrios, Agrupaciones) — untouched, still use
  `ProposableForm` with its own submit button.
- `EntityContributors.tsx` itself — only the label text it's given changes.

## File Structure

- Modify: `packages/i18n/messages/es.json` — reword `village.contributors.*`;
  add `village.festivalPosters.stepBasics/stepDates/stepAttribution` and
  `village.admin.places.stepBasics/stepAttribution`.
- Modify: `apps/mobile/components/feature/proposable/ProposableForm.tsx` — add
  optional `hideSubmit` prop.
- Modify: `apps/mobile/components/feature/proposable/FestivalPostersManager.tsx`
  — restructure into a 3-step `Stepper`.
- Modify: `apps/mobile/app/village/[villageId]/festival-posters.tsx` — wrap in
  `KeyboardAvoidingView`, set `bottomInset={false}`.
- Modify:
  `apps/mobile/components/feature/proposable/__tests__/FestivalPostersManager.test.tsx`
  — step through the wizard.
- Modify: `apps/mobile/components/feature/proposable/PlacesManager.tsx` —
  restructure into a 2-step `Stepper`.
- Modify: `apps/mobile/app/village/[villageId]/places.tsx` — wrap in
  `KeyboardAvoidingView`, set `bottomInset={false}`.
- Modify:
  `apps/mobile/components/feature/proposable/__tests__/PlacesManager.test.tsx`
  — step through the wizard.

## Global Constraints

- No `as any` / `@ts-nocheck` (strict TypeScript everywhere — see AGENTS.md §5).
- User-facing strings go through `useT()` / the `es.json` catalog — no
  hardcoded Spanish in these screens.
- Every `t('...')` key referenced in code must exist in
  `packages/i18n/messages/es.json`, or `packages/i18n/test/usedKeys.test.ts`
  fails.
- Work happens in a worktree (`.claude/worktrees/contributor-stepper/`) on
  branch `feat/contributor-stepper`, branched from latest `develop`. Never
  edit the base checkout in this mode.
- Conventional commits (`feat(mobile): ...`, `test(mobile): ...`), header ≤
  100 chars.

---

## Tasks

### Task 1: Set up the worktree

**Files:** none (git operations only).

- [ ] **Step 1: Create the worktree and branch**

```bash
cd /home/powervaro/githubs/cultuvilla
git fetch origin develop
git worktree add .claude/worktrees/contributor-stepper -b feat/contributor-stepper origin/develop
```

- [ ] **Step 2: Verify the worktree is on the right branch**

```bash
git -C .claude/worktrees/contributor-stepper rev-parse --abbrev-ref HEAD
```

Expected: `feat/contributor-stepper`

All remaining steps run with cwd
`/home/powervaro/githubs/cultuvilla/.claude/worktrees/contributor-stepper`
(use the absolute path — a bare `cd` does not persist across tool calls).

---

### Task 2: Reword the contributor credit strings

**Files:**
- Modify: `packages/i18n/messages/es.json:428-433`

**Interfaces:**
- Produces: no new keys — `village.contributors.label` /
  `.peopleLabel` / `.addPerson` / `.selectPeople` keep the same paths, only
  their string values change. No other task depends on the new text.

- [ ] **Step 1: Edit the four strings**

In `packages/i18n/messages/es.json`, replace the `village.contributors` block:

```json
    "contributors": {
      "label": "Digitalizado por",
      "peopleLabel": "Personas que digitalizaron esto",
      "addPerson": "Añadir persona",
      "selectPeople": "Seleccionar personas"
    },
```

- [ ] **Step 2: Run the i18n test suite**

```bash
pnpm --filter @cultuvilla/i18n test
```

Expected: PASS (key parity/used-keys tests only check key paths and JSON
validity, not string values, so this should be green with no other changes).

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "feat(i18n): reword contributor credit as 'digitalizado por'"
```

---

### Task 3: Add `hideSubmit` to `ProposableForm`

**Files:**
- Modify: `apps/mobile/components/feature/proposable/ProposableForm.tsx`
- Test: `apps/mobile/components/feature/proposable/__tests__/ProposableForm.test.tsx`

**Interfaces:**
- Produces: `ProposableFormProps.hideSubmit?: boolean` (default `false`).
  When `true`, the trailing `<Button>` is not rendered. `PlacesManager` (Task
  7) is the only consumer that passes `hideSubmit`; `BarriosManager` and
  `AgrupacionesManager` are untouched and keep the default (button shown).

- [ ] **Step 1: Write the failing test**

Add to `apps/mobile/components/feature/proposable/__tests__/ProposableForm.test.tsx`:

```tsx
  it('omits the submit button when hideSubmit is set', () => {
    const { queryByText } = render(
      <ProposableForm
        images={[]}
        onAddImage={() => {}}
        onRemoveImage={() => {}}
        name="Peña"
        onChangeName={() => {}}
        nameLabel="name"
        submitLabel="save"
        onSubmit={() => {}}
        saving={false}
        disabled={false}
        hideSubmit
      />,
    );
    expect(queryByText('save')).toBeNull();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter cultuvilla-mobile test -- ProposableForm
```

Expected: FAIL — `queryByText('save')` finds the button (prop doesn't exist
yet / is ignored).

- [ ] **Step 3: Implement `hideSubmit`**

In `ProposableForm.tsx`, add the prop to the interface:

```ts
  submitLabel: string;
  submitTestID?: string;
  onSubmit: () => void;
  saving: boolean;
  disabled: boolean;
  /** Omit the built-in submit button — used when a parent Stepper owns the
   * primary action instead (see PlacesManager). */
  hideSubmit?: boolean;
```

and in the function signature/body:

```ts
export function ProposableForm({
  images,
  onAddImage,
  onRemoveImage,
  addingImage,
  imageLabels,
  name,
  onChangeName,
  nameLabel,
  nameTestID,
  description,
  onChangeDescription,
  descriptionLabel,
  typeLabel,
  typeOptions,
  typeValue,
  onChangeType,
  footer,
  submitLabel,
  submitTestID,
  onSubmit,
  saving,
  disabled,
  hideSubmit,
}: ProposableFormProps) {
```

and replace the trailing button render:

```tsx
      {footer}

      {hideSubmit ? null : (
        <Button testID={submitTestID} onPress={onSubmit} loading={saving} disabled={disabled}>
          {submitLabel}
        </Button>
      )}
    </VStack>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter cultuvilla-mobile test -- ProposableForm
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feature/proposable/ProposableForm.tsx apps/mobile/components/feature/proposable/__tests__/ProposableForm.test.tsx
git commit -m "feat(mobile): let ProposableForm omit its submit button"
```

---

### Task 4: Add the new step-title i18n keys

**Files:**
- Modify: `packages/i18n/messages/es.json:434-449` (festivalPosters),
  `packages/i18n/messages/es.json:327-344` (admin.places)

**Interfaces:**
- Produces: `village.festivalPosters.stepBasics`, `.stepDates`,
  `.stepAttribution`; `village.admin.places.stepBasics`, `.stepAttribution`.
  Tasks 5 and 7 consume these via `t(...)`.

- [ ] **Step 1: Add the festival poster step keys**

In `packages/i18n/messages/es.json`, inside `village.festivalPosters` (right
after `"add": "Añadir",`):

```json
      "add": "Añadir",
      "stepBasics": "Lo básico",
      "stepDates": "Fechas",
      "stepAttribution": "Digitalización",
      "form": {
```

- [ ] **Step 2: Add the place step keys**

Inside `village.admin.places` (right after `"editTitle": "Editar lugar",`):

```json
        "editTitle": "Editar lugar",
        "stepBasics": "Lo básico",
        "stepAttribution": "Digitalización",
        "name": "Nombre",
```

- [ ] **Step 3: Run the i18n test suite**

```bash
pnpm --filter @cultuvilla/i18n test
```

Expected: PASS. (These keys aren't referenced yet — `usedKeys.test.ts` only
fails on a *used* key that's missing, never on an unused one — so this is
safe to commit ahead of Tasks 5/7.)

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "feat(i18n): add step titles for poster/place creation steppers"
```

---

### Task 5: Convert `FestivalPostersManager` to a 3-step `Stepper`

**Files:**
- Modify: `apps/mobile/components/feature/proposable/FestivalPostersManager.tsx`

**Interfaces:**
- Consumes: `Stepper`/`StepConfig` from `../Stepper` (props: `steps`,
  `onComplete`, `submitLabel`, `loading`, `primaryTestID`) — same as
  `apps/mobile/app/event/new.tsx` and `apps/mobile/app/news/new.tsx`.
- Produces: no external interface change — `FestivalPostersManager`'s own
  props (`villageId`, `onCreated`) and its `createFestivalPoster` payload are
  unchanged; only its internal JSX and the wizard testIDs change (steps are
  now separated, so `poster-year-input` and `poster-submit` are no longer on
  the same screen — Task 6 updates the tests for this).

- [ ] **Step 1: Replace the render body with a 3-step `Stepper`**

Replace the imports at the top of `FestivalPostersManager.tsx`:

```tsx
import { useState } from 'react';
import { ScrollView } from 'react-native';
import {
  newFestivalPosterId,
  createFestivalPoster,
} from '@cultuvilla/shared/services/festivalPosterService';
import {
  deleteImageByURL,
  uploadFestivalPosterImage,
} from '@cultuvilla/shared/services/imageService';
import { VStack, Input, FieldLabel, DateField } from '../../primitives';
import { MultiImagePickerRow } from '../MultiImagePickerRow';
import { Stepper, type StepConfig } from '../Stepper';
import { pickImageAsBlob } from '../../../lib/images';
import { useT } from '../../../lib/i18n';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { sanitizeYear, datesToPayload } from './festivalPosterForm';
import { OrganizerPicker } from '../OrganizerPicker';
```

(`Button` is dropped from this import list — the manager no longer renders
its own submit button, `Stepper` owns it.)

```tsx
function stepBody(children: React.ReactNode) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
```

Keep the component's state/handlers (`posterId`, `year`, `title`, `startsAt`,
`endsAt`, `images`, `addingImage`, `saving`, `contributorUserIds`,
`contributorOrgIds`, `handleContributorUsers`, `addImage`, `removeImage`,
`submit`) exactly as they are today — only the returned JSX changes. Replace
the `return (...)` block with:

```tsx
  const y = parseInt(year, 10);
  const steps: StepConfig[] = [
    {
      key: 'basics',
      title: t('village.festivalPosters.stepBasics'),
      icon: 'create-outline',
      validate: () => (Number.isInteger(y) && images.length > 0 ? [] : ['basics']),
      render: () =>
        stepBody(
          <>
            <VStack gap={1} align="start">
              <FieldLabel>{t('village.festivalPosters.form.image')}</FieldLabel>
              <MultiImagePickerRow
                uris={images}
                onAddPress={addImage}
                onRemove={removeImage}
                adding={addingImage}
                addLabel={t('village.festivalPosters.form.addImage')}
                removeLabel={t('village.festivalPosters.form.removeImage')}
              />
            </VStack>
            <Input
              testID="poster-year-input"
              value={year}
              onChangeText={(txt) => setYear(sanitizeYear(txt))}
              label={t('village.festivalPosters.form.year')}
              keyboardType="number-pad"
            />
            <Input
              testID="poster-title-input"
              value={title}
              onChangeText={setTitle}
              label={t('village.festivalPosters.form.title')}
              placeholder={t('village.festivalPosters.form.titlePlaceholder')}
            />
          </>,
        ),
    },
    {
      key: 'dates',
      title: t('village.festivalPosters.stepDates'),
      icon: 'calendar-outline',
      render: () =>
        stepBody(
          <>
            <DateField
              testID="poster-start-date"
              label={t('village.festivalPosters.form.startDate')}
              value={startsAt}
              onChange={setStartsAt}
            />
            <DateField
              testID="poster-end-date"
              label={t('village.festivalPosters.form.endDate')}
              value={endsAt}
              onChange={setEndsAt}
            />
          </>,
        ),
    },
    {
      key: 'attribution',
      title: t('village.festivalPosters.stepAttribution'),
      icon: 'people-outline',
      render: () =>
        stepBody(
          uid ? (
            <OrganizerPicker
              municipalityId={villageId}
              selectedUserIds={contributorUserIds.includes(uid) ? contributorUserIds : [uid, ...contributorUserIds]}
              selectedOrgIds={contributorOrgIds}
              lockedUserId={uid}
              onChangeUsers={handleContributorUsers}
              onChangeOrgs={setContributorOrgIds}
              peopleLabel={t('village.contributors.peopleLabel')}
              addPersonLabel={t('village.contributors.addPerson')}
              selectPeopleTitle={t('village.contributors.selectPeople')}
            />
          ) : null,
        ),
    },
  ];

  return (
    <Stepper
      steps={steps}
      onComplete={() => void submit()}
      submitLabel={t('village.festivalPosters.add')}
      loading={saving}
      primaryTestID="poster-submit"
    />
  );
```

Add the `VStack` import back (it was already imported at the top in the
current file — keep it in the import list alongside `Input`/`FieldLabel`/
`DateField`).

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter cultuvilla-mobile exec tsc --noEmit
```

Expected: no new errors from this file.

- [ ] **Step 3: Commit** (tests still reference the old flat form — Task 6
      fixes them next; commit here only if `tsc` is clean, otherwise fold
      into Task 6's commit)

```bash
git add apps/mobile/components/feature/proposable/FestivalPostersManager.tsx
git commit -m "feat(mobile): turn festival poster creation into a 3-step wizard"
```

---

### Task 6: Update `FestivalPostersManager.test.tsx` for the wizard

**Files:**
- Modify: `apps/mobile/components/feature/proposable/__tests__/FestivalPostersManager.test.tsx`

**Interfaces:**
- Consumes: `common.stepper.next` (the mocked `t` returns the key verbatim,
  so the button reads exactly `"common.stepper.next"` on non-final steps, and
  `"village.festivalPosters.add"` on the final step per `submitLabel`) and the
  step icons `create-outline`/`calendar-outline`/`people-outline` (not
  asserted). This mirrors `apps/mobile/app/event/__tests__/new.test.tsx`.

- [ ] **Step 1: Add the `Stepper`'s safe-area-inset mock**

`Stepper` (used internally now) calls `useSafeAreaInsets()`, which throws
`No safe area value available` when rendered without a provider in a jest
test. Add this mock near the top of the file, alongside the other
`jest.mock(...)` calls (mirrors `apps/mobile/app/news/__tests__/new.test.tsx`
and `apps/mobile/app/event/__tests__/new.test.tsx`):

```tsx
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
```

- [ ] **Step 2: Rewrite the two existing tests to step through the wizard**

Replace the `it(...)` blocks in `FestivalPostersManager.test.tsx`:

```tsx
describe('<FestivalPostersManager>', () => {
  it('any member submitting the form creates the poster directly (year precision, optimistic)', async () => {
    const { getByTestId, getByLabelText, getByText } = render(<FestivalPostersManager villageId="m1" />);
    fireEvent.press(getByLabelText('village.festivalPosters.form.addImage'));
    await waitFor(() => expect(mockPick).toHaveBeenCalled());
    fireEvent.changeText(getByTestId('poster-year-input'), '2026');
    fireEvent.press(getByText('common.stepper.next')); // basics -> dates
    fireEvent.press(getByText('common.stepper.next')); // dates -> attribution
    fireEvent.press(getByTestId('poster-submit')); // submit

    await waitFor(() =>
      expect(createFestivalPoster).toHaveBeenCalledWith(
        expect.objectContaining({
          municipalityId: 'm1',
          proposedBy: 'alice',
          contributorUserIds: ['alice'],
          contributorOrgIds: [],
          year: 2026,
          datePrecision: 'year',
          startsAt: null,
          endsAt: null,
          images: ['https://example.com/poster.jpg'],
        }),
        'new-id',
      ),
    );
    expect(uploadFestivalPosterImage).toHaveBeenCalledWith('m1', 'new-id', stubImage);
  });

  it('an admin creates the poster the same way', async () => {
    mockCaps.mockReturnValue({ canManage: true, canApprove: true, uid: 'boss', loading: false });
    const { getByTestId, getByLabelText, getByText } = render(<FestivalPostersManager villageId="m1" />);
    fireEvent.press(getByLabelText('village.festivalPosters.form.addImage'));
    await waitFor(() => expect(mockPick).toHaveBeenCalled());
    fireEvent.changeText(getByTestId('poster-year-input'), '2027');
    fireEvent.press(getByText('common.stepper.next'));
    fireEvent.press(getByText('common.stepper.next'));
    fireEvent.press(getByTestId('poster-submit'));

    await waitFor(() =>
      expect(createFestivalPoster).toHaveBeenCalledWith(
        expect.objectContaining({ municipalityId: 'm1', year: 2027, datePrecision: 'year' }),
        'new-id',
      ),
    );
  });
});
```

Note `primaryTestID="poster-submit"` (set in Task 5) keeps `getByTestId`
working across every step, including the final submit press — only the
button's visible label changes between `"common.stepper.next"` and the
submit label.

- [ ] **Step 3: Run the test file**

```bash
pnpm --filter cultuvilla-mobile test -- FestivalPostersManager
```

Expected: PASS (2 tests).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/feature/proposable/FestivalPostersManager.tsx apps/mobile/components/feature/proposable/__tests__/FestivalPostersManager.test.tsx
git commit -m "test(mobile): step FestivalPostersManager tests through the new wizard"
```

---

### Task 7: Update `festival-posters.tsx` for the Stepper's own bottom bar

**Files:**
- Modify: `apps/mobile/app/village/[villageId]/festival-posters.tsx`

**Interfaces:** none beyond the screen's existing `villageId` param.

- [ ] **Step 1: Wrap in `KeyboardAvoidingView` and disable the Screen's own bottom inset**

Replace the file's return with:

```tsx
import { Platform } from 'react-native';
import { KeyboardAvoidingView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { FestivalPostersManager } from '../../../components/feature/proposable/FestivalPostersManager';

export default function FestivalPostersScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader title={t('village.festivalPosters.add')} />
      {villageId ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FestivalPostersManager villageId={villageId} onCreated={() => router.back()} />
        </KeyboardAvoidingView>
      ) : null}
    </Screen>
  );
}
```

- [ ] **Step 2: Typecheck + run the poster tests once more**

```bash
pnpm --filter cultuvilla-mobile exec tsc --noEmit
pnpm --filter cultuvilla-mobile test -- FestivalPostersManager
```

Expected: both clean/green.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/village/\[villageId\]/festival-posters.tsx
git commit -m "fix(mobile): apply the wizard's own bottom inset on the poster create screen"
```

---

### Task 8: Convert `PlacesManager` to a 2-step `Stepper`

**Files:**
- Modify: `apps/mobile/components/feature/proposable/PlacesManager.tsx`

**Interfaces:**
- Consumes: `Stepper`/`StepConfig` from `../Stepper`; `ProposableForm`'s new
  `hideSubmit` prop (Task 3).
- Produces: no external interface change — same as Task 5's note, but for
  places (`place-name-input` and `place-submit` are no longer on the same
  screen — Task 9 updates the tests).

- [ ] **Step 1: Replace the render body with a 2-step `Stepper`**

Replace the imports:

```tsx
import { useState } from 'react';
import { ScrollView } from 'react-native';
import {
  createPlace, newPlaceId,
} from '@cultuvilla/shared/services/municipalityService';
import { deleteImageByURL, uploadPlaceImage } from '@cultuvilla/shared/services/imageService';
import { PLACE_KINDS, type PlaceKind } from '@cultuvilla/shared/models/municipality';
import { Stepper, type StepConfig } from '../Stepper';
import { pickImageAsBlob } from '../../../lib/images';
import { useT } from '../../../lib/i18n';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { ProposableForm } from './ProposableForm';
import { OrganizerPicker } from '../OrganizerPicker';

function stepBody(children: React.ReactNode) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
```

Keep the component's state/handlers (`placeId`, `name`, `description`,
`kind`, `images`, `addingImage`, `saving`, `contributorUserIds`,
`contributorOrgIds`, `kindLabel`, `addImage`, `removeImage`, `submit`)
unchanged. Replace the `return (...)` block with:

```tsx
  const steps: StepConfig[] = [
    {
      key: 'basics',
      title: t('village.admin.places.stepBasics'),
      icon: 'create-outline',
      validate: () => (name.trim() ? [] : ['name']),
      render: () =>
        stepBody(
          <ProposableForm
            images={images}
            onAddImage={addImage}
            onRemoveImage={removeImage}
            addingImage={addingImage}
            imageLabels={{
              add: t('village.admin.places.addImage'),
              remove: t('village.admin.places.removeImage'),
            }}
            name={name}
            onChangeName={setName}
            nameLabel={t('village.admin.places.name')}
            nameTestID="place-name-input"
            description={description}
            onChangeDescription={setDescription}
            descriptionLabel={t('village.admin.places.description')}
            typeLabel={t('village.admin.places.kindLabel')}
            typeOptions={PLACE_KINDS.map((k) => ({ value: k, label: kindLabel(k) }))}
            typeValue={kind}
            onChangeType={(v) => setKind(v as PlaceKind)}
            submitLabel=""
            onSubmit={() => {}}
            saving={false}
            disabled={false}
            hideSubmit
          />,
        ),
    },
    {
      key: 'attribution',
      title: t('village.admin.places.stepAttribution'),
      icon: 'people-outline',
      render: () =>
        stepBody(
          uid ? (
            <OrganizerPicker
              municipalityId={villageId}
              selectedUserIds={contributorUserIds.includes(uid) ? contributorUserIds : [uid, ...contributorUserIds]}
              selectedOrgIds={contributorOrgIds}
              lockedUserId={uid}
              onChangeUsers={setContributorUserIds}
              onChangeOrgs={setContributorOrgIds}
              peopleLabel={t('village.contributors.peopleLabel')}
              addPersonLabel={t('village.contributors.addPerson')}
              selectPeopleTitle={t('village.contributors.selectPeople')}
            />
          ) : null,
        ),
    },
  ];

  return (
    <Stepper
      steps={steps}
      onComplete={() => void submit()}
      submitLabel={t('village.admin.places.add')}
      loading={saving}
      primaryTestID="place-submit"
    />
  );
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter cultuvilla-mobile exec tsc --noEmit
```

Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/feature/proposable/PlacesManager.tsx
git commit -m "feat(mobile): turn place creation into a 2-step wizard"
```

---

### Task 9: Update `PlacesManager.test.tsx` for the wizard

**Files:**
- Modify: `apps/mobile/components/feature/proposable/__tests__/PlacesManager.test.tsx`

**Interfaces:**
- Consumes: same `common.stepper.next` / `primaryTestID="place-submit"`
  pattern as Task 6.

- [ ] **Step 1: Add the `Stepper`'s safe-area-inset mock**

Same reason as Task 6: `Stepper` calls `useSafeAreaInsets()`, which throws
without a provider in a jest test. Add this mock near the top of the file,
alongside the other `jest.mock(...)` calls:

```tsx
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
```

- [ ] **Step 2: Rewrite the four tests to step through the wizard**

```tsx
describe('<PlacesManager>', () => {
  it('any member submitting the form creates the place directly (default kind, optimistic)', async () => {
    const { getByTestId, getByText } = render(<PlacesManager villageId="m1" />);
    fireEvent.changeText(getByTestId('place-name-input'), 'Fuente');
    fireEvent.press(getByText('common.stepper.next')); // basics -> attribution
    fireEvent.press(getByTestId('place-submit')); // submit
    await waitFor(() =>
      expect(createPlace).toHaveBeenCalledWith(
        'm1',
        { name: 'Fuente', kind: 'cemetery', description: '', municipalityId: 'm1', proposedBy: 'alice', images: [], contributorUserIds: ['alice'], contributorOrgIds: [] },
        'new-id',
      ),
    );
  });

  it('an admin creates the place the same way', async () => {
    mockCaps.mockReturnValue({ canManage: true, canApprove: true, uid: 'boss', loading: false });
    const { getByTestId, getByText } = render(<PlacesManager villageId="m1" />);
    fireEvent.changeText(getByTestId('place-name-input'), 'Iglesia');
    fireEvent.press(getByText('common.stepper.next'));
    fireEvent.press(getByTestId('place-submit'));
    await waitFor(() =>
      expect(createPlace).toHaveBeenCalledWith(
        'm1',
        { name: 'Iglesia', kind: 'cemetery', description: '', municipalityId: 'm1', proposedBy: 'boss', images: [], contributorUserIds: ['boss'], contributorOrgIds: [] },
        'new-id',
      ),
    );
  });

  it('uploads a picked image to the minted place id and includes it in the create payload', async () => {
    const { getByTestId, getByLabelText, getByText } = render(<PlacesManager villageId="m1" />);
    fireEvent.press(getByLabelText('village.admin.places.addImage'));
    await waitFor(() => expect(mockPick).toHaveBeenCalled());
    fireEvent.changeText(getByTestId('place-name-input'), 'Fuente');
    fireEvent.press(getByText('common.stepper.next'));
    fireEvent.press(getByTestId('place-submit'));

    expect(uploadPlaceImage).toHaveBeenCalledWith('m1', 'new-id', stubImage);
    await waitFor(() =>
      expect(createPlace).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({ images: ['https://example.com/place.jpg'] }),
        'new-id',
      ),
    );
  });

  it('mints the place id up front via newPlaceId', () => {
    render(<PlacesManager villageId="m1" />);
    expect(newPlaceId).toHaveBeenCalledWith('m1');
  });
});
```

- [ ] **Step 3: Run the test file**

```bash
pnpm --filter cultuvilla-mobile test -- PlacesManager
```

Expected: PASS (4 tests).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/feature/proposable/PlacesManager.tsx apps/mobile/components/feature/proposable/__tests__/PlacesManager.test.tsx
git commit -m "test(mobile): step PlacesManager tests through the new wizard"
```

---

### Task 10: Update `places.tsx` for the Stepper's own bottom bar

**Files:**
- Modify: `apps/mobile/app/village/[villageId]/places.tsx`

- [ ] **Step 1: Wrap in `KeyboardAvoidingView` and disable the Screen's own bottom inset**

```tsx
import { Platform } from 'react-native';
import { KeyboardAvoidingView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { PlacesManager } from '../../../components/feature/proposable/PlacesManager';

export default function PlacesScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader title={t('village.admin.places.add')} />
      {villageId ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <PlacesManager villageId={villageId} onCreated={() => router.back()} />
        </KeyboardAvoidingView>
      ) : null}
    </Screen>
  );
}
```

- [ ] **Step 2: Typecheck + run the place tests once more**

```bash
pnpm --filter cultuvilla-mobile exec tsc --noEmit
pnpm --filter cultuvilla-mobile test -- PlacesManager
```

Expected: both clean/green.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/village/\[villageId\]/places.tsx
git commit -m "fix(mobile): apply the wizard's own bottom inset on the place create screen"
```

---

### Task 11: Full targeted verification + PR

**Files:** none (verification + PR only).

- [ ] **Step 1: Run the full mobile test + typecheck + i18n suites**

```bash
pnpm app:test
pnpm app:typecheck
pnpm --filter @cultuvilla/i18n test
```

Expected: all green.

- [ ] **Step 2: Update the CHANGELOG**

Add under `## [Unreleased]` in `CHANGELOG.md`:

```markdown
- Reworded the place/festival-poster contributor credit as "Digitalizado
  por" and turned their creation screens into step-by-step wizards.
```

- [ ] **Step 3: Commit the changelog entry**

```bash
git add CHANGELOG.md
git commit -m "docs: note contributor wording + stepper creation in changelog"
```

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/contributor-stepper
gh pr create --title "feat(mobile): reword contributor credit, wizard-ify place/poster creation" --body "$(cat <<'EOF'
## Summary
- Reword the place/festival-poster "contributors" credit around "Digitalizado por" (digitalized by), across detail, edit, and create screens (single shared i18n namespace).
- Convert the two creation screens (festival poster, place) from a flat scrolling form into a step-by-step Stepper, matching event/news creation — poster: Lo básico / Fechas / Digitalización; place: Lo básico / Digitalización.
- Edit screens for both entities are unchanged (still flat forms), as are the other proposable managers (Barrios, Agrupaciones).

## Test plan
- [x] `pnpm app:test`
- [x] `pnpm app:typecheck`
- [x] `pnpm --filter @cultuvilla/i18n test`
- [ ] Full CI gate green on the PR
- [ ] Manual: create a festival poster and a place through the new wizard on web, confirm the attribution step shows "Digitalización" and the detail screen shows "Digitalizado por"
EOF
)"
```

- [ ] **Step 5: Report the PR URL to the user and stop**

Per AGENTS.md's development workflow, wait for the user to review CI and
explicitly confirm before merging — do not merge autonomously.
