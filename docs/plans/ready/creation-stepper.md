# Creation Stepper

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce one shared multi-step "stepper" component, inspired by the
ordago-apps creation wizard but rebuilt on cultuvilla's primitives and design
tokens, and refit the field-heavy creation screens (Profile, Persona a tu cargo,
Event) onto it.

**Architecture:** A new `Stepper` + `StepIndicator` pair under
`apps/mobile/components/feature/`, built only from existing primitives
(`Button`, `Pressable`, `Text`, `HStack`, `View`) and themed with the existing
`accent` (terracotta) token. It renders one step at a time (no horizontal swipe),
gates forward navigation on per-step validation (inline errors, no `Alert`), and
owns only step-cursor state — form data stays in each screen. `PersonForm`
renders the `Stepper` internally, so both Profile and Persona adopt it through a
single shared form.

**Tech Stack:** Expo Router, React Native, NativeWind (`className`), jest +
`@testing-library/react-native` (NOT vitest — that is `packages/shared` only).

## Context

ordago-apps has a well-liked creation wizard, but it is not a single shared
component — it is a pattern copy-pasted across three flows
(`CreateMatchStepper`, `CreateTournamentStepper`, `CreateOrganizerStepper`),
assembled from `CustomStepIndicator` (icon dots + connectors),
`StepperNavigation` (Back/Next/Finish footer) and a horizontal paging
`ScrollView`, themed with a hardcoded green palette. cultuvilla is a different
stack, so we reproduce the *UX*, not the files, on cultuvilla primitives and
tokens.

Two ordago mechanics are deliberately **not** ported because both misbehave on
cultuvilla's RN-Web build (memories `project_alert_on_web`,
`project_animated_view_className`): horizontal swipe-paging between steps, and
`Alert.alert` popups on invalid Next.

### Corrections discovered during planning (supersede earlier draft)

- Profile (`(onboarding)/complete-profile.tsx`) did **not** share `PersonForm` —
  it had a duplicated inline form. The two are unified in this work.
- **Residence belongs in both** Profile and Persona. `PersonForm` already has
  residence (village + barrio), so unifying onto it satisfies this.
- **Telephone is dropped from profile creation.** Collecting a phone number is
  deferred to the event-registration flow (only when an event requires it) — a
  separate future task, out of scope here.
- **Active village derives from residence.** Profile's `activeMunicipalityId` is
  set to the residence municipality chosen in the form; the standalone
  account-village picker is removed. Users still switch villages later via the
  existing switcher.

## Design / approach

### The shared component (`apps/mobile/components/feature/`)

- **`StepIndicator`** — numbered dots joined by connector lines.
  - completed & current dots: `bg-accent` / `border-accent`, label `text-on-accent`
  - locked (not-yet-reached) dots: `bg-subtle` / `border-subtle`, label `text-muted`
  - connector left of a reached step: `bg-accent`; otherwise `bg-subtle`
  - tapping a dot for index `<= highestReached` navigates there; locked dots are
    disabled.
- **`Stepper`** — container. Renders `StepIndicator`, the current step's title +
  `render()` (only the current step), an optional `submitError`, and a footer.
  Owns `current` + `highestReached` state only.
  - Footer: `Atrás` (`ghost` `Button`, omitted on first step) + a primary
    `Button` that is `Siguiente` on non-final steps and `submitLabel` on the
    last. The primary button is **disabled whenever the current step's
    `validate()` returns a non-empty array**. On the last step it calls
    `onComplete`.
  - Back navigation never validates. Forward navigation (Next or tapping a
    forward dot) is blocked while the current step is invalid.
- **`StepConfig`**: `{ key, title, render: () => ReactNode, validate?: () => string[] }`.

### PersonForm (shared by Profile + Persona)

`PersonForm` keeps its current public props (`initial`, `submitLabel`,
`loading`, `error`, `onSubmit`) and gains one optional prop
`requireFullName?: boolean` (default `false`). Internally it renders a `Stepper`
with three steps:

1. **Identidad** — photo, given name, first surname, second surname, nickname, sex
2. **Origen y residencia** — birthday, birthplace (`VillagePicker`), residence
   municipality + barrio (`VillagePicker` + `BarrioPicker`)
3. **Sobre ti** — biography

Validation:
- Step 1: always requires `givenName`. When `requireFullName` is `true` (Profile),
  also requires `firstSurname` and `secondSurname`.
- Step 2: when `requireFullName` is `true`, requires `birthday`; otherwise no gate.
- Step 3: no gate.

`onComplete` wires to the existing `handleSubmit`; `submitError` shows `error`.

Because both Profile and Persona render `PersonForm`, they adopt the stepper
together. `app/person/[personId].tsx` needs **no change** (its `PersonForm` use
and its test — which mocks `PersonForm` — are unaffected).

### Profile screen refactor (`(onboarding)/complete-profile.tsx`)

Replace the inline form with `<PersonForm requireFullName ... />`. Its `onSubmit`
builds the `Person` (including residence via `buildResidenceLinks`), uploads the
photo, and creates/patches the `UserProfile` with
`activeMunicipalityId = values.municipalityId` and `personId`. Telephone and the
separate account-village picker are removed.

### Event screen refactor (`app/event/new.tsx`)

Keep the existing eligibility / loading / load-error gates. Replace the single
scrolling form with a `Stepper` of three steps:

1. **Lo básico** — title, description, cover image
2. **Cuándo y dónde** — start date, end date, location
3. **Detalles** — organización (selector + request-organizer button), aforo
   máximo, teléfono-requerido toggle

Validation: step 1 requires title + description; step 2 requires a start date;
step 3 no gate. `onComplete` calls the existing `submit()`; `loading` is
`isPending`; `submitLabel` is `t('event.createEvent')`.

### Screens that stay single-form (out of scope)

News (`news/new.tsx`), Start village (`discover/start/[municipalityId].tsx`),
Organizer request (`discover/organize/[municipalityId].tsx`) — too few fields to
justify a wizard. Also out of scope: the inline "proposable" creators (Barrios,
Organizations, Places), the Censo schema editor, the telephone-at-event-
registration relocation, and a dark-mode palette.

## Global Constraints

- All user-facing strings go through `useT()` / the `packages/i18n` catalog —
  no hardcoded Spanish in `apps/mobile`. Add keys to `packages/i18n/messages/es.json`.
- Colors come only from semantic tokens (`bg-accent`, `border-accent`,
  `text-on-accent`, `bg-subtle`, `border-subtle`, `text-muted`). No raw hex, no
  green, no ordago tokens.
- No `Alert.alert`; no horizontal swipe-paging `ScrollView`.
- Tests use jest + `@testing-library/react-native`. Run with `pnpm --filter cultuvilla-mobile test`.
- Do not change `PersonForm`'s existing public prop names/types except to add
  the optional `requireFullName`.

## File Structure

- Create: `apps/mobile/components/feature/StepIndicator.tsx` — dots + connectors.
- Create: `apps/mobile/components/feature/Stepper.tsx` — container + `StepConfig` type.
- Create: `apps/mobile/components/feature/__tests__/StepIndicator.test.tsx`
- Create: `apps/mobile/components/feature/__tests__/Stepper.test.tsx`
- Create: `apps/mobile/components/feature/__tests__/PersonForm.test.tsx`
- Create: `apps/mobile/app/event/__tests__/new.test.tsx`
- Modify: `packages/i18n/messages/es.json` — stepper nav + step-title strings.
- Modify: `apps/mobile/components/feature/PersonForm.tsx` — render `Stepper`, add `requireFullName`.
- Modify: `apps/mobile/app/(onboarding)/complete-profile.tsx` — use shared `PersonForm`.
- Modify: `apps/mobile/app/event/new.tsx` — render `Stepper`.
- Unchanged (verify still green): `apps/mobile/app/person/[personId].tsx` and its test.

---

### Task 1: i18n strings for the stepper

**Files:**
- Modify: `packages/i18n/messages/es.json`

Use the `i18n-add-string` skill conventions. Add the nav labels under `common`
and step titles under the existing `profile.personForm` and `event` namespaces.

- [ ] **Step 1: Add the keys**

In `common` add:
```json
"stepper": { "back": "Atrás", "next": "Siguiente" }
```
In `profile.personForm` (object already exists) add:
```json
"stepIdentity": "Identidad",
"stepResidence": "Origen y residencia",
"stepAbout": "Sobre ti"
```
In `event` (object already exists) add:
```json
"stepBasics": "Lo básico",
"stepWhen": "Cuándo y dónde",
"stepDetails": "Detalles"
```

- [ ] **Step 2: Verify the JSON parses and typecheck passes**

Run: `pnpm --filter @cultuvilla/i18n build || node -e "JSON.parse(require('fs').readFileSync('packages/i18n/messages/es.json','utf8'))"`
Expected: no parse error.

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "i18n: add creation-stepper nav + step-title strings"
```

---

### Task 2: StepIndicator component

**Files:**
- Create: `apps/mobile/components/feature/StepIndicator.tsx`
- Test: `apps/mobile/components/feature/__tests__/StepIndicator.test.tsx`

**Interfaces:**
- Produces: `StepIndicator` (default-less named export) with props
  `{ count: number; current: number; highestReached: number; onStepPress: (index: number) => void }`.
  Each dot has `testID={`step-dot-${i}`}`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/components/feature/__tests__/StepIndicator.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { StepIndicator } from '../StepIndicator';

describe('<StepIndicator>', () => {
  it('renders one dot per step', () => {
    const { getByTestId } = render(
      <StepIndicator count={3} current={0} highestReached={0} onStepPress={() => {}} />,
    );
    expect(getByTestId('step-dot-0')).toBeTruthy();
    expect(getByTestId('step-dot-1')).toBeTruthy();
    expect(getByTestId('step-dot-2')).toBeTruthy();
  });

  it('navigates to a reached step on press', () => {
    const onStepPress = jest.fn();
    const { getByTestId } = render(
      <StepIndicator count={3} current={2} highestReached={2} onStepPress={onStepPress} />,
    );
    fireEvent.press(getByTestId('step-dot-0'));
    expect(onStepPress).toHaveBeenCalledWith(0);
  });

  it('ignores presses on locked (not-yet-reached) steps', () => {
    const onStepPress = jest.fn();
    const { getByTestId } = render(
      <StepIndicator count={3} current={0} highestReached={0} onStepPress={onStepPress} />,
    );
    fireEvent.press(getByTestId('step-dot-2'));
    expect(onStepPress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter cultuvilla-mobile test StepIndicator`
Expected: FAIL — cannot find module `../StepIndicator`.

- [ ] **Step 3: Implement the component**

```tsx
// apps/mobile/components/feature/StepIndicator.tsx
import { Fragment } from 'react';
import { View } from 'react-native';
import { Pressable, Text } from '../primitives';

export interface StepIndicatorProps {
  count: number;
  current: number;
  highestReached: number;
  onStepPress: (index: number) => void;
}

export function StepIndicator({ count, current, highestReached, onStepPress }: StepIndicatorProps) {
  return (
    <View className="flex-row items-center px-5 py-4">
      {Array.from({ length: count }, (_, i) => {
        const reached = i <= highestReached;
        const active = i <= current;
        return (
          <Fragment key={i}>
            <Pressable
              testID={`step-dot-${i}`}
              disabled={!reached}
              onPress={() => onStepPress(i)}
              className={`w-8 h-8 rounded-full border items-center justify-center ${
                active ? 'bg-accent border-accent' : 'bg-subtle border-subtle'
              }`}
            >
              <Text variant="bodySm" tone={active ? 'onAccent' : 'muted'}>
                {String(i + 1)}
              </Text>
            </Pressable>
            {i < count - 1 && (
              <View className={`flex-1 h-0.5 mx-2 ${i < current ? 'bg-accent' : 'bg-subtle'}`} />
            )}
          </Fragment>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter cultuvilla-mobile test StepIndicator`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feature/StepIndicator.tsx apps/mobile/components/feature/__tests__/StepIndicator.test.tsx
git commit -m "feat(mobile): add StepIndicator for the creation stepper"
```

---

### Task 2.5: A note on jest mocks used in stepper/screen tests

The screen tests below mock `useT` so `t(key)` returns the key verbatim (the
established pattern — see `app/person/__tests__/personId.test.tsx`). Stepper's
own test passes plain strings as step titles and stubs `useT` the same way.
There is no separate deliverable here; this note prevents duplicated mock setup.

---

### Task 3: Stepper container

**Files:**
- Create: `apps/mobile/components/feature/Stepper.tsx`
- Test: `apps/mobile/components/feature/__tests__/Stepper.test.tsx`

**Interfaces:**
- Consumes: `StepIndicator` from Task 2.
- Produces:
  - `interface StepConfig { key: string; title: string; render: () => ReactNode; validate?: () => string[] }`
  - `Stepper` with props
    `{ steps: StepConfig[]; onComplete: () => void | Promise<void>; submitLabel: string; loading?: boolean; submitError?: string | null }`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/components/feature/__tests__/Stepper.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Stepper, type StepConfig } from '../Stepper';

jest.mock('../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (k: string) => k }),
}));

function makeSteps(overrides: Partial<StepConfig>[] = []): StepConfig[] {
  const base: StepConfig[] = [
    { key: 'a', title: 'Step A', render: () => <Text>content-a</Text> },
    { key: 'b', title: 'Step B', render: () => <Text>content-b</Text> },
  ];
  return base.map((s, i) => ({ ...s, ...overrides[i] }));
}

describe('<Stepper>', () => {
  it('renders the first step and its title', () => {
    const { getByText } = render(
      <Stepper steps={makeSteps()} submitLabel="Crear" onComplete={() => {}} />,
    );
    expect(getByText('Step A')).toBeTruthy();
    expect(getByText('content-a')).toBeTruthy();
  });

  it('advances to the next step when the current step is valid', () => {
    const { getByText } = render(
      <Stepper steps={makeSteps()} submitLabel="Crear" onComplete={() => {}} />,
    );
    fireEvent.press(getByText('common.stepper.next'));
    expect(getByText('content-b')).toBeTruthy();
  });

  it('blocks advancing while the current step is invalid', () => {
    const steps = makeSteps([{ validate: () => ['err'] }]);
    const { getByText, queryByText } = render(
      <Stepper steps={steps} submitLabel="Crear" onComplete={() => {}} />,
    );
    fireEvent.press(getByText('common.stepper.next'));
    expect(queryByText('content-b')).toBeNull();
  });

  it('goes back without validating', () => {
    const { getByText } = render(
      <Stepper steps={makeSteps()} submitLabel="Crear" onComplete={() => {}} />,
    );
    fireEvent.press(getByText('common.stepper.next'));
    fireEvent.press(getByText('common.stepper.back'));
    expect(getByText('content-a')).toBeTruthy();
  });

  it('calls onComplete from the last step', () => {
    const onComplete = jest.fn();
    const { getByText } = render(
      <Stepper steps={makeSteps()} submitLabel="Crear" onComplete={onComplete} />,
    );
    fireEvent.press(getByText('common.stepper.next'));
    fireEvent.press(getByText('Crear'));
    expect(onComplete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter cultuvilla-mobile test Stepper`
Expected: FAIL — cannot find module `../Stepper`.

- [ ] **Step 3: Implement the component**

```tsx
// apps/mobile/components/feature/Stepper.tsx
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Button, HStack, Text } from '../primitives';
import { useT } from '../../lib/i18n';
import { StepIndicator } from './StepIndicator';

export interface StepConfig {
  key: string;
  title: string;
  render: () => ReactNode;
  validate?: () => string[];
}

export interface StepperProps {
  steps: StepConfig[];
  onComplete: () => void | Promise<void>;
  submitLabel: string;
  loading?: boolean;
  submitError?: string | null;
}

export function Stepper({ steps, onComplete, submitLabel, loading = false, submitError }: StepperProps) {
  const { t } = useT();
  const [current, setCurrent] = useState(0);
  const [highestReached, setHighestReached] = useState(0);

  const step = steps[current];
  const isLast = current === steps.length - 1;
  const stepValid = (step.validate?.() ?? []).length === 0;

  function goTo(index: number) {
    if (index <= current) {
      setCurrent(index); // back nav never validates
      return;
    }
    if (index <= highestReached && stepValid) setCurrent(index);
  }

  function handleNext() {
    if (!stepValid) return;
    const next = current + 1;
    setCurrent(next);
    setHighestReached((h) => Math.max(h, next));
  }

  return (
    <View className="flex-1">
      <StepIndicator
        count={steps.length}
        current={current}
        highestReached={highestReached}
        onStepPress={goTo}
      />
      <View className="flex-1">
        <Text variant="h3" className="px-4 pb-2">{step.title}</Text>
        {step.render()}
      </View>
      {submitError ? <Text tone="danger" className="px-4 pb-2">{submitError}</Text> : null}
      <HStack gap={3} className="px-4 py-3">
        <View className="flex-1">
          {current > 0 ? (
            <Button variant="ghost" onPress={() => setCurrent(current - 1)} disabled={loading} fullWidth>
              {t('common.stepper.back')}
            </Button>
          ) : null}
        </View>
        <View className="flex-1">
          <Button
            onPress={() => { if (isLast) void onComplete(); else handleNext(); }}
            loading={loading}
            disabled={!stepValid}
            fullWidth
          >
            {isLast ? submitLabel : t('common.stepper.next')}
          </Button>
        </View>
      </HStack>
    </View>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter cultuvilla-mobile test Stepper`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feature/Stepper.tsx apps/mobile/components/feature/__tests__/Stepper.test.tsx
git commit -m "feat(mobile): add Stepper container for creation flows"
```

---

### Task 4: Refactor PersonForm onto the Stepper

**Files:**
- Modify: `apps/mobile/components/feature/PersonForm.tsx`
- Test: `apps/mobile/components/feature/__tests__/PersonForm.test.tsx`

**Interfaces:**
- Consumes: `Stepper`, `StepConfig` from Task 3.
- Produces: `PersonForm` keeps its existing props plus
  `requireFullName?: boolean` (default `false`).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/components/feature/__tests__/PersonForm.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { PersonForm } from '../PersonForm';

jest.mock('../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));

describe('<PersonForm> stepper', () => {
  it('shows the identity step first and blocks Next without a given name', () => {
    const onSubmit = jest.fn();
    const { getByText, queryByText } = render(
      <PersonForm submitLabel="Guardar" onSubmit={onSubmit} />,
    );
    // Identity step title is visible; about-step content is not yet.
    expect(getByText('profile.personForm.stepIdentity')).toBeTruthy();
    fireEvent.press(getByText('common.stepper.next'));
    // Still on step 1 — residence step title not shown.
    expect(queryByText('profile.personForm.stepResidence')).toBeNull();
  });

  it('advances once a given name is entered', () => {
    const { getByText, getByLabelText } = render(
      <PersonForm submitLabel="Guardar" onSubmit={jest.fn()} />,
    );
    fireEvent.changeText(getByLabelText('onboarding.completeProfile.givenName'), 'Ana');
    fireEvent.press(getByText('common.stepper.next'));
    expect(getByText('profile.personForm.stepResidence')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter cultuvilla-mobile test PersonForm`
Expected: FAIL — the form is single-page; `common.stepper.next` is not found.

- [ ] **Step 3: Refactor the component**

Add `requireFullName?: boolean` to `PersonFormProps`. Keep all existing field
state. Replace the single `ScrollView` body + bottom `Button` with a `Stepper`
whose three steps wrap the existing fields. Each step's body stays inside a
`ScrollView` so long content scrolls. Validation reads the live state.

```tsx
// inside PersonForm, after the existing useState hooks and handleSubmit:
import { Stepper, type StepConfig } from './Stepper';
// ...
function stepBody(children: ReactNode) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <VStack gap={3}>{children}</VStack>
    </ScrollView>
  );
}

const steps: StepConfig[] = [
  {
    key: 'identity',
    title: t('profile.personForm.stepIdentity'),
    validate: () => {
      const errs: string[] = [];
      if (!givenName.trim()) errs.push('givenName');
      if (requireFullName && !firstSurname.trim()) errs.push('firstSurname');
      if (requireFullName && !secondSurname.trim()) errs.push('secondSurname');
      return errs;
    },
    render: () =>
      stepBody(
        <>
          <View className="items-center">
            <Avatar
              uri={photo?.uri ?? initial?.photoURL ?? undefined}
              size={96}
              onPress={async () => { const next = await pickImage(); if (next) setPhoto(next); }}
            />
          </View>
          <Input label={t('onboarding.completeProfile.givenName')} value={givenName} onChangeText={setGivenName} />
          <Input label={t('onboarding.completeProfile.firstSurname')} value={firstSurname} onChangeText={setFirstSurname} />
          <Input label={t('onboarding.completeProfile.secondSurname')} value={secondSurname} onChangeText={setSecondSurname} />
          <Input label={t('onboarding.completeProfile.nickname')} value={nickname} onChangeText={setNickname} />
          <Text tone="muted">{t('onboarding.completeProfile.sex')}</Text>
          <VStack gap={2}>
            {(['female', 'male', 'other'] as const).map((opt) => (
              <Button key={opt} variant={sex === opt ? 'primary' : 'secondary'} onPress={() => setSex(sex === opt ? null : opt)}>
                {t(`onboarding.completeProfile.sex_${opt}`)}
              </Button>
            ))}
          </VStack>
        </>,
      ),
  },
  {
    key: 'residence',
    title: t('profile.personForm.stepResidence'),
    validate: () => (requireFullName && !birthday ? ['birthday'] : []),
    render: () =>
      stepBody(
        <>
          <DateField
            label={t('onboarding.completeProfile.birthday')}
            value={birthday}
            onChange={setBirthday}
            minimumDate={new Date(1900, 0, 1)}
            maximumDate={new Date()}
            testID="birthday"
          />
          <VillagePicker label={t('onboarding.completeProfile.birthPlace')} value={birthPlace} onChange={setBirthPlace} />
          <VillagePicker label={t('profile.personForm.village')} value={municipalityId} onChange={handleVillageChange} />
          <BarrioPicker
            label={t('profile.personForm.barrio')}
            municipalityId={municipalityId}
            value={barrioId}
            onChange={setBarrioId}
            wholeVillageLabel={t('profile.personForm.wholeVillage')}
          />
        </>,
      ),
  },
  {
    key: 'about',
    title: t('profile.personForm.stepAbout'),
    render: () =>
      stepBody(
        <Input
          label={t('onboarding.completeProfile.biography')}
          value={biography}
          onChangeText={setBiography}
          multiline
          numberOfLines={4}
        />,
      ),
  },
];

return (
  <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Stepper steps={steps} onComplete={handleSubmit} submitLabel={submitLabel} loading={loading} submitError={error} />
  </KeyboardAvoidingView>
);
```

(Remove the old `ScrollView`/bottom-`Button` JSX and the now-unused direct
`error` render — `error` is passed to `Stepper` as `submitError`.)

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter cultuvilla-mobile test PersonForm`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify the Persona screen test still passes**

Run: `pnpm --filter cultuvilla-mobile test personId`
Expected: PASS (it mocks `PersonForm`, so it is unaffected).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/feature/PersonForm.tsx apps/mobile/components/feature/__tests__/PersonForm.test.tsx
git commit -m "feat(mobile): render PersonForm as a 3-step stepper"
```

---

### Task 5: Unify Profile onto the shared PersonForm

**Files:**
- Modify: `apps/mobile/app/(onboarding)/complete-profile.tsx`

**Interfaces:**
- Consumes: `PersonForm`, `PersonFormValues`, `PersonFormPhoto` (Task 4);
  `buildResidenceLinks` from `@cultuvilla/shared/models/person` (same import the
  Persona screen uses — confirm the exact path in `app/person/[personId].tsx`).

- [ ] **Step 1: Rewrite the screen to delegate to PersonForm**

Replace the inline form, its field `useState`s, and `onSubmit` body with a
`PersonForm`. The screen keeps `loading`/`error` state and the create/patch
orchestration, moved into the `onSubmit` callback.

```tsx
// apps/mobile/app/(onboarding)/complete-profile.tsx (core)
export default function CompleteProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: PersonFormValues, photo: PersonFormPhoto | null) {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      const birthPlaceLink: MunicipalityLink | null = values.birthPlaceMunicipalityId
        ? { municipalityId: values.birthPlaceMunicipalityId, barrioId: null }
        : null;
      const municipalityLinks = buildResidenceLinks(values.municipalityId, values.barrioId);

      let personId: string;
      if (profile?.personId) {
        personId = profile.personId;
      } else {
        const existing = await getPersonByUserId(user.uid);
        personId = existing
          ? existing.id
          : await createPerson({
              givenName: values.givenName.trim(),
              firstSurname: values.firstSurname.trim() || null,
              secondSurname: values.secondSurname.trim() || null,
              nickname: values.nickname.trim() || null,
              sex: values.sex,
              birthday: toPartialDate(values.birthday),
              birthPlace: birthPlaceLink,
              municipalityLinks,
              biography: values.biography.trim() || null,
              userId: user.uid,
              createdBy: user.uid,
            });
      }

      if (photo) {
        const url = await uploadUserPhoto(user.uid, {
          blob: photo.blob,
          filename: `avatar-${Date.now()}.jpg`,
          contentType: photo.blob.type || 'image/jpeg',
        });
        await updatePerson(personId, { photoURL: url });
      }

      const profilePatch = {
        activeMunicipalityId: values.municipalityId, // derive active village from residence
        personId,
      };
      if (profile) {
        await patchUserProfile(user.uid, profilePatch);
      } else {
        await createUserProfile(user.uid, { email: user.email ?? '', ...profilePatch });
      }
      await refreshProfile();
      // AuthGate (_layout.tsx) owns post-onboarding routing.
    } catch (e) {
      setError(e instanceof Error ? e.message : t('onboarding.completeProfile.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen padded={false} bottomInset={false}>
      <Text variant="h2" className="px-4 pt-4">{t('onboarding.completeProfile.title')}</Text>
      <PersonForm
        requireFullName
        initial={{ municipalityId: profile?.activeMunicipalityId ?? null }}
        submitLabel={t('onboarding.completeProfile.submit')}
        loading={loading}
        error={error}
        onSubmit={onSubmit}
      />
    </Screen>
  );
}
```

Remove now-unused imports (`HStack`, `VStack`, `Input`, `Button`, `Avatar`,
`DateField`, `VillagePicker`, `ScrollView`) and the `telephone`/`accountVillage`
state. Keep `createUserProfile`/`patchUserProfile`/`createPerson`/`updatePerson`/
`getPersonByUserId`/`uploadUserPhoto`/`toPartialDate`. Drop the `UserProfile`
`telephone` field from creation (deferred to event-registration).

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter cultuvilla-mobile exec tsc --noEmit`
Expected: no errors (verify `createUserProfile`/`patchUserProfile` accept a
payload without `telephone` — both fields were optional; if `telephone` is
required by the type, pass `telephone: profile?.telephone ?? null` to preserve it
rather than introducing a new required value).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(onboarding)/complete-profile.tsx
git commit -m "feat(mobile): unify Profile creation onto shared PersonForm stepper"
```

---

### Task 6: Refactor the Event create screen onto the Stepper

**Files:**
- Modify: `apps/mobile/app/event/new.tsx`
- Test: `apps/mobile/app/event/__tests__/new.test.tsx`

**Interfaces:**
- Consumes: `Stepper`, `StepConfig` (Task 3).

- [ ] **Step 1: Write the failing smoke test**

```tsx
// apps/mobile/app/event/__tests__/new.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import NewEventScreen from '../new';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'uid-1', email: 'a@b.test' }, profile: { activeMunicipalityId: 'm-1' } }),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipality: jest.fn().mockResolvedValue({ name: 'Pueblo', coordinates: null }),
}));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getOrganizationsByMunicipality: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/orgMemberService', () => ({
  getOrgMembershipsByUserInMunicipality: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/eventService', () => ({
  createEvent: jest.fn().mockResolvedValue('e-1'),
  updateEvent: jest.fn(),
}));

describe('NewEventScreen stepper', () => {
  it('renders the first step and gates Next until title + description are set', async () => {
    const { getByText, getByLabelText, queryByText } = render(<NewEventScreen />);
    await waitFor(() => expect(getByText('event.stepBasics')).toBeTruthy());
    fireEvent.press(getByText('common.stepper.next'));
    expect(queryByText('event.stepWhen')).toBeNull(); // blocked: empty title/description
    fireEvent.changeText(getByLabelText('event.title'), 'Fiesta');
    fireEvent.changeText(getByLabelText('event.description'), 'Desc');
    fireEvent.press(getByText('common.stepper.next'));
    expect(getByText('event.stepWhen')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter cultuvilla-mobile test event/__tests__/new`
Expected: FAIL — `event.stepBasics` / `common.stepper.next` not found.

- [ ] **Step 3: Refactor the create-form branch**

Leave the no-village / loading / load-error early returns unchanged. Replace the
final `KeyboardAvoidingView`+`ScrollView` form with a `Stepper`. Group the
existing fields into three `stepBody`-wrapped steps (same `stepBody` helper shape
as Task 4):

```tsx
const steps: StepConfig[] = [
  {
    key: 'basics',
    title: t('event.stepBasics'),
    validate: () => {
      const e: string[] = [];
      if (!title.trim()) e.push('title');
      if (!description.trim()) e.push('description');
      return e;
    },
    render: () => stepBody(
      <>
        <Input label={t('event.title')} value={title} onChangeText={setTitle} />
        <Input label={t('event.description')} value={description} onChangeText={setDescription} multiline numberOfLines={5} />
        <Text tone="muted">{t('event.imageLabel')}</Text>
        {cover && <Image source={{ uri: cover.uri }} style={{ width: '100%', height: 160, borderRadius: 8 }} accessibilityIgnoresInvertColors />}
        <Button variant="secondary" onPress={async () => { const n = await pickImage(); if (n) setCover(n); }}>
          {cover ? t('event.changeImage') : t('event.addImage')}
        </Button>
      </>,
    ),
  },
  {
    key: 'when',
    title: t('event.stepWhen'),
    validate: () => (startDate ? [] : ['startDate']),
    render: () => stepBody(
      <>
        <DateField label={t('event.startDate')} value={startDate} onChange={setStartDate} testID="startDate" />
        <DateField label={t('event.endDate')} value={endDate} onChange={setEndDate} testID="endDate" />
        <Input label={t('event.location')} value={locationText} onChangeText={setLocationText} />
      </>,
    ),
  },
  {
    key: 'details',
    title: t('event.stepDetails'),
    render: () => stepBody(
      <>
        <Text tone="muted">{t('event.organizationLabel')}</Text>
        <Button variant={selectedOrgId === null ? 'primary' : 'secondary'} onPress={() => setSelectedOrgId(null)}>
          {t('event.noOrganization')}
        </Button>
        {memberOrgs.map((o) => (
          <Button key={o.id} variant={selectedOrgId === o.id ? 'primary' : 'secondary'} onPress={() => setSelectedOrgId(o.id)}>
            {o.name}
          </Button>
        ))}
        {memberOrgs.length === 0 && (
          <Button variant="secondary" onPress={() => router.push(`/discover/organize/${municipalityId}` as never)}>
            {t('event.eligibility.requestOrganizer')}
          </Button>
        )}
        <Input label={t('event.maxAttendees')} value={maxAttendees} onChangeText={setMaxAttendees} keyboardType="numeric" />
        <Button variant={telephoneRequired ? 'primary' : 'secondary'} onPress={() => setTelephoneRequired((v) => !v)}>
          {t('event.telephoneRequired')}
        </Button>
      </>,
    ),
  },
];

return (
  <Screen padded={false} bottomInset={false}>
    <ScreenHeader title={t('event.createEvent')} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stepper steps={steps} onComplete={() => void submit()} submitLabel={t('event.createEvent')} loading={isPending} />
    </KeyboardAvoidingView>
  </Screen>
);
```

(The old `canSubmit` is now expressed by step validation; the final submit still
guards `municipalityId`/`user`/`startDate` inside the `useCallable` callback, so
keep that guard.)

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter cultuvilla-mobile test event/__tests__/new`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/event/new.tsx apps/mobile/app/event/__tests__/new.test.tsx
git commit -m "feat(mobile): render Event create as a 3-step stepper"
```

---

### Task 7: Full verification

- [ ] **Step 1: Run the mobile test suite + typecheck + lint**

Run: `pnpm --filter cultuvilla-mobile test && pnpm --filter cultuvilla-mobile exec tsc --noEmit && pnpm check`
Expected: all green.

- [ ] **Step 2: Manual smoke (optional, per `drive-android-avd`)**

Boot the AVD, deep-link into `event/new` and onboarding, confirm steps advance,
Back works, dots are tappable only for visited steps, and the accent (terracotta)
styling renders.

## Testing

Covered per task: jest/RTL unit tests for `StepIndicator` and `Stepper`, a
`PersonForm` stepper test, and an `Event` create smoke test, plus a regression
check that the existing `personId` test (which mocks `PersonForm`) still passes.
Final gate runs `pnpm --filter cultuvilla-mobile test`, `tsc --noEmit`, and `pnpm check`.

## Out of scope

- Telephone collection (relocate to event registration) — separate task.
- News / Start village / Organizer request single-form screens.
- Inline proposable creators and the Censo schema editor.
- Dark-mode palette.
