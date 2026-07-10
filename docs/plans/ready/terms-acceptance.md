# Terms & Conditions acceptance at onboarding

## Goal

Require every new user to accept the Terms of Use and Privacy Policy before their
profile is created, persist a versioned acceptance record, and ship the two legal
documents (Spanish, RGPD/LOPDGDD + LSSI-CE compliant) as in-app screens.

## Context

Cultuvilla handles personal data (persona profiles: name, sex, birthday, birthplace,
biography, photo, residence pueblo/barrio; account email + phone; event registrations)
but has **no terms, no privacy policy, and no consent record** today. The user menu
carries "Términos de uso" / "Política de privacidad" entries marked *coming soon*, and
`UserData` has no consent field.

Auth is passwordless (email magic-link + Google), so there is no classic register form
— the Firebase Auth account is created when the user completes the link / Google flow,
*before* any form. The first data-collection form is onboarding
(`apps/mobile/app/(onboarding)/complete-profile.tsx`), where `createUserProfile` writes
the user doc. That is where acceptance is captured.

## Decisions (resolved during brainstorming)

- **Placement:** onboarding form (`complete-profile.tsx`), gating the profile-creation
  write — not the login screen.
- **Documents:** one combined checkbox referencing both docs, each opening an in-app
  scrollable screen. Full text lives in the repo.
- **Storage:** persist `termsAcceptedAt` (timestamp) **and** `termsVersion` (string), so
  the version can be bumped later and stale-version users re-prompted.
- **Data controller / service provider:** Álvaro Francisco Gil, NIF 50242222X, Plaza
  Manuel Mateo 11, 28044 Madrid, España. Legal/RGPD contact: cultuvilla.app@gmail.com.
- **Processors disclosed:** Google Firebase (Auth, Firestore, Storage, Functions,
  Hosting) — EU data location; plus **Google Analytics for Firebase** and **Firebase
  Crashlytics**, disclosed now (planned, not yet integrated) to avoid a later re-prompt.
- **Initial version:** `termsVersion = "1.0"`.

## Design / approach

### 1. Data model

Add to `UserDataSchema` (`packages/shared/src/models/user/UserDataModel.ts`):

- `termsAcceptedAt: Timestamp`
- `termsVersion: string`

Export a `CURRENT_TERMS_VERSION = "1.0"` constant from shared as the single source of
truth (consumed by the onboarding write and any future re-prompt check). Add both fields
to the client-writable set in `firestore.rules` (the user doc's own-write allowlist) and
to the `createUserProfile` payload in `userService.ts`.

Because reads go through a **strict Zod converter**, the new required fields would crash
reads of existing dev user docs. Ship `scripts/backfill-terms-acceptance.mjs`
(idempotent, project-id guarded, mirrors `scripts/backfill-municipality-namelower.mjs`):
patch only docs missing the field, setting `termsVersion = "1.0"` and
`termsAcceptedAt = <existing createdAt>`. Run against dev (`villa-events`) and verify
with `pnpm check:dev-conformance`.

### 2. Checkbox primitive

Add `apps/mobile/components/primitives/Checkbox.tsx` (modeled on `Toggle.tsx`,
`accessibilityRole="checkbox"`), export from the primitives barrel, add a colocated
`__tests__/Checkbox.test.tsx`. A checkbox reads better than a switch for legal consent.

### 3. Onboarding integration

In `complete-profile.tsx`, add the checkbox above the submit button, with a label
containing two tappable links to the legal screens. **Submit disabled until checked**;
show a validation message if the user tries to submit unchecked. On submit,
`createUserProfile` stamps `termsAcceptedAt: serverTimestamp()` and
`termsVersion: CURRENT_TERMS_VERSION`.

### 4. Legal screens + content

Establish a simple long-form pattern (none exists): routes `app/(legal)/terms.tsx` and
`app/(legal)/privacy.tsx` using `Screen` + `ScrollView` + `Text`. The Spanish legal text
lives as a content module in the repo (documents, not UI strings) so both the screens and
the un-stubbed user-menu entries render the same source. Wire the two `comingSoon` menu
items in `UserMenuModal.tsx` to these routes.

### 5. i18n

UI strings (checkbox label, link labels, "debes aceptar los términos" validation) go in
`packages/i18n/messages/es.json`. The long legal bodies stay in the content module.

### 6. The legal documents (content to write)

**Privacy Policy (Política de privacidad)** — responsable del tratamiento (Álvaro
Francisco Gil, NIF, dirección, email); categorías de datos (cuenta: email/teléfono;
perfil de persona; inscripciones a eventos; pertenencia a pueblos/organizaciones);
finalidades y bases jurídicas (ejecución del servicio / consentimiento / interés
legítimo); encargados del tratamiento (Google Firebase — Auth/Firestore/Storage/
Functions/Hosting, ubicación UE; Google Analytics for Firebase + Firebase Crashlytics);
transferencias internacionales; plazos de conservación; derechos RGPD (acceso,
rectificación, supresión, oposición, portabilidad, limitación) y cómo ejercerlos;
reclamación ante la AEPD; nota sobre menores; cambios en la política.

**Terms of Use (Términos de uso)** — identificación del prestador (LSSI-CE); descripción
del servicio; requisitos de acceso (edad, veracidad); modelo de autenticación sin
contraseña; uso aceptable y prohibiciones; contenido generado por usuarios y licencia;
roles de pueblo/organización y moderación; propiedad intelectual; exención y limitación
de responsabilidad; suspensión/baja de cuentas; ley aplicable (española) y jurisdicción;
modificaciones de los términos.

---

# Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Architecture:** Two new required fields on the `users/{uid}` doc, gated through the same
strict-Zod converter + firestore.rules allowlist every other user field passes through.
The consent UI is an onboarding-only injection into the existing `PersonForm`/`Stepper`
(the generic form stays consent-agnostic). The legal text is a shared content module
rendered by one reusable screen consumed by two routes and the user menu.

**Tech Stack:** TypeScript (strict), Zod, Firestore + security rules, Expo Router v4,
React Native, NativeWind, vitest (`@cultuvilla/shared`), `@firebase/rules-unit-testing`
(e2e rules), jest (`apps/mobile`), firebase-admin (backfill).

## Global Constraints

- `strict: true`, no `any`, no `@ts-nocheck`, no `eslint-disable` (AGENTS.md §Strict TS).
- Components/screens/hooks must NOT import `firebase/*` directly — go through a service.
- `termsVersion` initial value is exactly `"1.0"`; the constant `CURRENT_TERMS_VERSION`
  in `@cultuvilla/shared/models/user` is the single source of truth. Never inline `"1.0"`.
- New required model fields ⇒ backfill dev (`villa-events`) in the same change; verify with
  `pnpm check:dev-conformance`. Dev backfill is autonomous; beta/prod are off-limits.
- User-facing strings go through `useT()` / `packages/i18n/messages/es.json`. The long
  legal bodies are documents, not UI strings — they live in the content module.
- Claude does NOT run emulator-backed tests (`test:rules`, `test:integration`, mobile
  jest that needs emulators) or dev servers. Steps that need them say "ASK USER TO RUN".

## File Structure

- **Modify:**
  - `packages/shared/src/models/user/UserDataModel.ts` — add fields, constant, builder
  - `packages/shared/src/services/userService.ts` — write fields in `createUserProfile`
  - `firestore.rules` — add fields to the user create/update/onboarding-merge allowlists
  - `apps/mobile/components/feature/PersonForm.tsx` — optional consent footer + gate
  - `apps/mobile/app/(onboarding)/complete-profile.tsx` — consent state + stamp on submit
  - `apps/mobile/components/feature/UserMenuModal.tsx` — un-stub legal items → routes
  - `apps/mobile/components/primitives/index.ts` — export `Checkbox`
  - `packages/i18n/messages/es.json` — consent + legal-screen UI strings
  - `packages/shared/test/models/user/UserDataModel.test.ts` — new-field assertions
  - `packages/shared/test/e2e/usersRules.test.ts` — payload + new-field rules cases
  - `packages/shared/src/services/_services-map.md` — note the consent fields
  - `CHANGELOG.md` — `[Unreleased]` entry
- **Create:**
  - `apps/mobile/components/primitives/Checkbox.tsx` (+ `__tests__/Checkbox.test.tsx`)
  - `apps/mobile/lib/legal/content.ts` — structured Spanish text for both documents
  - `apps/mobile/components/feature/LegalDocScreen.tsx` — reusable renderer
  - `apps/mobile/app/legal/_layout.tsx`, `.../legal/terms.tsx`, `.../legal/privacy.tsx`
  - `scripts/backfill-terms-acceptance.mjs`

---

## Task 1: Model — consent fields, version constant, builder

**Files:**
- Modify: `packages/shared/src/models/user/UserDataModel.ts`
- Test: `packages/shared/test/models/user/UserDataModel.test.ts`

**Interfaces:**
- Produces: `CURRENT_TERMS_VERSION: string` (`"1.0"`); `UserDataSchema` gains
  `termsAcceptedAt: Date` and `termsVersion: string`; `UserDataInput` gains
  `termsAcceptedAt?: Date | null` and `termsVersion?: string`; `buildUserData` defaults
  `termsVersion` to `CURRENT_TERMS_VERSION` and `termsAcceptedAt` to `new Date()`.

- [ ] **Step 1: Write the failing test** — append to `UserDataModel.test.ts`:

```ts
import {
  UserDataSchema,
  buildUserData,
  CURRENT_TERMS_VERSION,
} from '../../../src/models/user/UserDataModel';

describe('UserDataSchema — terms acceptance', () => {
  const base = {
    displayName: 'Ana',
    email: 'ana@b.com',
    telephone: null,
    activeMunicipalityId: null,
    personId: null,
    createdAt: new Date(),
  };

  it('accepts a doc carrying termsAcceptedAt + termsVersion', () => {
    const parsed = UserDataSchema.parse({
      ...base,
      termsAcceptedAt: new Date('2026-07-10T00:00:00Z'),
      termsVersion: '1.0',
    });
    expect(parsed.termsVersion).toBe('1.0');
    expect(parsed.termsAcceptedAt).toBeInstanceOf(Date);
  });

  it('throws when the consent fields are missing (strict — forces backfill)', () => {
    expect(() => UserDataSchema.parse(base)).toThrow();
  });

  it('CURRENT_TERMS_VERSION is the published version', () => {
    expect(CURRENT_TERMS_VERSION).toBe('1.0');
  });

  it('buildUserData stamps the current version and an acceptance date', () => {
    const u = buildUserData({ displayName: 'Ana', email: 'ana@b.com' });
    expect(u.termsVersion).toBe(CURRENT_TERMS_VERSION);
    expect(u.termsAcceptedAt).toBeInstanceOf(Date);
  });
});
```

Also update the two existing `UserDataSchema.parse(...)` "fully populated"/"missing
displayName" cases and both `buildUserData` cases in this file to include
`termsAcceptedAt: new Date(), termsVersion: '1.0'` in their inputs/expectations so they
keep passing under the now-required fields.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared test -- UserDataModel`
Expected: FAIL — `CURRENT_TERMS_VERSION` is not exported / consent fields unknown.

- [ ] **Step 3: Implement** — edit `UserDataModel.ts`:

```ts
/** The Terms of Use + Privacy Policy version a new acceptance is stamped with.
 * Single source of truth; bump on a substantive legal change (and plan a
 * re-prompt — see docs/decisions when that lands). */
export const CURRENT_TERMS_VERSION = '1.0';

export const UserDataSchema = z.object({
  displayName: z.string().default(''),
  email: z.string(),
  telephone: z.string().nullable(),
  activeMunicipalityId: z.string().nullable(),
  personId: z.string().nullable(),
  createdAt: z.date(),
  // Legal acceptance captured at onboarding. Required: every account created
  // after this feature carries it, and existing dev docs are backfilled.
  termsAcceptedAt: z.date(),
  termsVersion: z.string(),
});
```

Add to `UserDataInput`:

```ts
  termsAcceptedAt?: Date | null;
  termsVersion?: string;
```

And to `buildUserData`'s returned object:

```ts
    termsAcceptedAt: input.termsAcceptedAt ?? new Date(),
    termsVersion: input.termsVersion ?? CURRENT_TERMS_VERSION,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared test -- UserDataModel`
Expected: PASS.

- [ ] **Step 5: Check the converter test** — `packages/shared/test/firebase/converters/userConverter.test.ts`
may construct user docs without the new fields. Run
`pnpm --filter @cultuvilla/shared test -- userConverter` and, if it fails, add
`termsAcceptedAt`/`termsVersion` to the fixtures there. Same for
`packages/shared/test/services/userService.test.ts` (run `-- userService`).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/models/user/UserDataModel.ts packages/shared/test/
git commit -m "feat(shared): add versioned terms-acceptance fields to UserData"
```

---

## Task 2: Service — write consent fields in createUserProfile

**Files:**
- Modify: `packages/shared/src/services/userService.ts`
- Test: `packages/shared/test/services/userService.test.ts`

**Interfaces:**
- Consumes: `CURRENT_TERMS_VERSION`, `ClientUserInput` (now includes the two optional
  consent fields via `UserDataInput`).
- Produces: `createUserProfile` writes `termsAcceptedAt` and `termsVersion` into the merge
  payload. Caller passes `termsAcceptedAt` (a `serverTimestamp()` sentinel) and
  `termsVersion`; the service falls back to `CURRENT_TERMS_VERSION` if version omitted.

- [ ] **Step 1: Write/extend the failing test** — in `userService.test.ts`, assert the
merge payload includes the consent fields. Match the file's existing mocking style for
`setDoc`; the assertion is:

```ts
it('createUserProfile persists the terms acceptance', async () => {
  await createUserProfile('uid-1', {
    email: 'ana@b.com',
    personId: 'p1',
    termsAcceptedAt: SENTINEL, // whatever the file uses for serverTimestamp()
    termsVersion: '1.0',
  });
  const payload = setDocMock.mock.calls[0][1];
  expect(payload.termsVersion).toBe('1.0');
  expect(payload).toHaveProperty('termsAcceptedAt');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared test -- userService`
Expected: FAIL — payload lacks the consent fields.

- [ ] **Step 3: Implement** — in `createUserProfile`, extend the merge object:

```ts
  await setDoc(
    docRef,
    {
      email: input.email,
      telephone: input.telephone ?? null,
      activeMunicipalityId: input.activeMunicipalityId ?? null,
      personId: input.personId ?? null,
      createdAt: serverTimestamp(),
      termsAcceptedAt: input.termsAcceptedAt ?? serverTimestamp(),
      termsVersion: input.termsVersion ?? CURRENT_TERMS_VERSION,
    },
    { merge: true },
  );
```

Add the import: `import { CURRENT_TERMS_VERSION } from '../models/user';`.
Leave `patchUserProfile` untouched — consent is set once at creation, not edited.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared test -- userService`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/services/userService.ts packages/shared/test/services/userService.test.ts
git commit -m "feat(shared): stamp terms acceptance in createUserProfile"
```

---

## Task 3: Firestore rules — allow the consent fields

**Files:**
- Modify: `firestore.rules`
- Test: `packages/shared/test/e2e/usersRules.test.ts`

**Interfaces:**
- Produces: the user create/update/onboarding-merge shape predicates accept exactly
  `termsAcceptedAt` (timestamp) and `termsVersion` (string) in addition to the existing
  fields; no other new keys allowed.

- [ ] **Step 1: Write the failing rules test** — in `usersRules.test.ts`, update the
shared payload builder to carry the consent fields, and add a rejection case:

```ts
const createUserProfilePayload = () => ({
  email: 'ana@example.com',
  telephone: null,
  activeMunicipalityId: null,
  personId: 'p1',
  createdAt: serverTimestamp(),
  termsAcceptedAt: serverTimestamp(),
  termsVersion: '1.0',
});

it('rejects an unknown extra key on create', async () => {
  const ownerDb = asUser(getEnv(), OWNER);
  await assertFails(
    setDoc(
      doc(ownerDb, `users/${OWNER}`),
      { ...createUserProfilePayload(), sneaky: true },
      { merge: true },
    ),
  );
});
```

- [ ] **Step 2: ASK USER TO RUN the rules test (needs emulators)**

Ask the user to run: `pnpm --filter @cultuvilla/shared test:rules -- usersRules`
Expected before the fix: FAIL — the new keys aren't in the allowlist, so the "owner can
create" / onboarding-merge cases are rejected.

- [ ] **Step 3: Implement** — edit `firestore.rules`:

In `hasValidUserFields`, add:

```
          && isTimestamp(d.termsAcceptedAt)
          && isString(d.termsVersion)
```

In `isValidUserCreate`, add `'termsAcceptedAt', 'termsVersion'` to BOTH the `hasOnly([...])`
and `hasAll([...])` key lists.

In `isValidUserUpdateKeys`, add `'termsAcceptedAt', 'termsVersion'` to the `hasOnly([...])`
(the onboarding merge lands on the update path and carries them).

In `isOnboardingUserMerge`, add `'termsAcceptedAt', 'termsVersion'` to the
`affectedKeys().hasOnly([...])` list.

- [ ] **Step 4: ASK USER TO RUN the rules test again**

Ask the user to run: `pnpm --filter @cultuvilla/shared test:rules -- usersRules`
Expected: PASS.

- [ ] **Step 5: Commit** (after the user confirms green)

```bash
git add firestore.rules packages/shared/test/e2e/usersRules.test.ts
git commit -m "feat(rules): allow versioned terms-acceptance fields on user doc"
```

Deploy rules to dev via the `firestore-deploy` skill after Task 6 is verified.

---

## Task 4: Checkbox primitive

**Files:**
- Create: `apps/mobile/components/primitives/Checkbox.tsx`,
  `apps/mobile/components/primitives/__tests__/Checkbox.test.tsx`
- Modify: `apps/mobile/components/primitives/index.ts`

**Interfaces:**
- Produces: `Checkbox({ value, onValueChange, label?, testID? }: CheckboxProps)` —
  `accessibilityRole="checkbox"`, `accessibilityState={{ checked: value }}`.

- [ ] **Step 1: Write the failing test** — `__tests__/Checkbox.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Checkbox } from '../Checkbox';

describe('Checkbox', () => {
  it('toggles on press', () => {
    const onValueChange = jest.fn();
    const { getByTestId } = render(
      <Checkbox value={false} onValueChange={onValueChange} testID="cb" />,
    );
    fireEvent.press(getByTestId('cb'));
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('reflects checked state for accessibility', () => {
    const { getByTestId } = render(
      <Checkbox value onValueChange={() => {}} testID="cb" />,
    );
    expect(getByTestId('cb').props.accessibilityState.checked).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm app:test -- Checkbox`
Expected: FAIL — module `../Checkbox` not found.

- [ ] **Step 3: Implement** — `Checkbox.tsx` (modeled on `Toggle.tsx`; plain `View`s for
NativeWind/RN-Web safety, `Ionicons` checkmark, `iconSizes` token):

```tsx
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { iconSizes } from '@cultuvilla/shared/design-system';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { HStack } from './HStack';

export interface CheckboxProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  label?: React.ReactNode;
  testID?: string;
}

// Square consent checkbox. Token names mirror Toggle:
//   bg-accent / border-accent — checked;  bg-surface / border-subtle — unchecked.
export function Checkbox({ value, onValueChange, label, testID }: CheckboxProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
    >
      <HStack gap={2} align="center">
        <View
          className={`w-6 h-6 rounded-sm border items-center justify-center ${
            value ? 'bg-accent border-accent' : 'bg-surface border-subtle'
          }`}
        >
          {value ? (
            <Ionicons name="checkmark" size={iconSizes.sm} color="white" />
          ) : null}
        </View>
        {typeof label === 'string' ? <Text>{label}</Text> : label}
      </HStack>
    </Pressable>
  );
}
```

Verify the `iconSizes` import path against `Toggle.tsx`/other primitives; if the
design-system subpath differs, match the existing convention. Add
`export * from './Checkbox';` (or the file's export style) to `index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm app:test -- Checkbox`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/primitives/Checkbox.tsx apps/mobile/components/primitives/__tests__/Checkbox.test.tsx apps/mobile/components/primitives/index.ts
git commit -m "feat(mobile): add Checkbox primitive"
```

---

## Task 5: Legal content module + reusable screen + routes

**Files:**
- Create: `apps/mobile/lib/legal/content.ts`, `apps/mobile/components/feature/LegalDocScreen.tsx`,
  `apps/mobile/app/legal/_layout.tsx`, `apps/mobile/app/legal/terms.tsx`,
  `apps/mobile/app/legal/privacy.tsx`

**Interfaces:**
- Produces: `LEGAL_DOCS: { terms: LegalDoc; privacy: LegalDoc }` where
  `LegalDoc = { title: string; updated: string; version: string; sections: LegalSection[] }`
  and `LegalSection = { heading: string; body: string[] }`; a `LegalDocScreen({ doc })`
  component; routes `/legal/terms` and `/legal/privacy`.

- [ ] **Step 1: Create the content module** — `apps/mobile/lib/legal/content.ts`.
Transcribe the full Spanish text from `docs/legal/terminos-de-uso.md` and
`docs/legal/politica-de-privacidad.md` into structured sections. Set
`version: CURRENT_TERMS_VERSION` (import from `@cultuvilla/shared/models/user`) and
`updated: '10 de julio de 2026'`. Shape:

```ts
import { CURRENT_TERMS_VERSION } from '@cultuvilla/shared/models/user';

export interface LegalSection { heading: string; body: string[]; }
export interface LegalDoc {
  title: string;
  updated: string;
  version: string;
  sections: LegalSection[];
}

const updated = '10 de julio de 2026';

export const LEGAL_DOCS: { terms: LegalDoc; privacy: LegalDoc } = {
  terms: {
    title: 'Términos de uso',
    updated,
    version: CURRENT_TERMS_VERSION,
    sections: [
      { heading: '1. Identificación del prestador', body: [ /* … */ ] },
      // … one section per heading in docs/legal/terminos-de-uso.md
    ],
  },
  privacy: {
    title: 'Política de privacidad',
    updated,
    version: CURRENT_TERMS_VERSION,
    sections: [ /* one section per heading in docs/legal/politica-de-privacidad.md */ ],
  },
};
```

The markdown files are the source of truth — copy the text verbatim (drop markdown
syntax; each paragraph/bullet becomes a `body` string).

- [ ] **Step 2: Create `LegalDocScreen.tsx`** — a `Screen` + `ScrollView` renderer:

```tsx
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen, Text, VStack } from '../primitives';
import { ScreenHeader } from '../layout/ScreenHeader';
import type { LegalDoc } from '../../lib/legal/content';

export function LegalDocScreen({ doc }: { doc: LegalDoc }) {
  const insets = useSafeAreaInsets();
  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader title={doc.title} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 24 }}>
        <Text variant="bodySm" tone="secondary">{`Versión ${doc.version} · ${doc.updated}`}</Text>
        <VStack gap={4}>
          {doc.sections.map((s) => (
            <VStack key={s.heading} gap={2}>
              <Text variant="titleSm">{s.heading}</Text>
              {s.body.map((p, i) => (
                <Text key={i}>{p}</Text>
              ))}
            </VStack>
          ))}
        </VStack>
      </ScrollView>
    </Screen>
  );
}
```

Verify `ScreenHeader` props (`title`, back behaviour) and the `Text` `variant`/`tone`
values against existing screens; adjust to real prop names.

- [ ] **Step 3: Create the routes** — `app/legal/_layout.tsx` mirrors the onboarding
layout (`<Stack screenOptions={{ headerShown: false }} />`). Then:

```tsx
// app/legal/terms.tsx
import { LegalDocScreen } from '../../components/feature/LegalDocScreen';
import { LEGAL_DOCS } from '../../lib/legal/content';
export default function TermsScreen() { return <LegalDocScreen doc={LEGAL_DOCS.terms} />; }
```

```tsx
// app/legal/privacy.tsx
import { LegalDocScreen } from '../../components/feature/LegalDocScreen';
import { LEGAL_DOCS } from '../../lib/legal/content';
export default function PrivacyScreen() { return <LegalDocScreen doc={LEGAL_DOCS.privacy} />; }
```

- [ ] **Step 4: Verify the routes render** — ASK USER TO RUN the app and navigate to
`/legal/terms` and `/legal/privacy` (or drive via the `drive-android-avd` / web build).
Expected: both screens scroll through the full text with the version line at top.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/legal apps/mobile/components/feature/LegalDocScreen.tsx apps/mobile/app/legal
git commit -m "feat(mobile): add legal document screens for terms and privacy"
```

---

## Task 6: Onboarding — consent checkbox gates profile creation

**Files:**
- Modify: `apps/mobile/components/feature/PersonForm.tsx`,
  `apps/mobile/app/(onboarding)/complete-profile.tsx`,
  `packages/i18n/messages/es.json`

**Interfaces:**
- Consumes: `Checkbox`, `LEGAL_DOCS`/routes, `CURRENT_TERMS_VERSION`, `createUserProfile`.
- Produces: `PersonForm` gains optional `renderConsent?: () => ReactNode` (rendered in the
  final "about" step) and `consentSatisfied?: boolean` (folded into the final step's
  `validate()` so the submit button disables until consent is given). Onboarding passes
  both; every other `PersonForm` consumer omits them (behaviour unchanged).

- [ ] **Step 1: Extend `PersonForm`** — add the two optional props to `PersonFormProps`
and the destructure. In the `'about'` step, render consent below the biography and gate
the step:

```tsx
    {
      key: 'about',
      title: t('profile.personForm.stepAbout'),
      icon: 'document-text-outline',
      validate: () =>
        consentSatisfied === false ? ['consent'] : [],
      render: () =>
        stepBody(
          <>
            {/* …existing photo + biography fields… */}
            {renderConsent?.()}
          </>,
        ),
    },
```

`consentSatisfied === false` (not falsy) so that consumers omitting the prop
(`undefined`) are never gated. The `Stepper` already disables the submit button when the
last step's `validate()` returns a non-empty array — no Stepper change needed.

- [ ] **Step 2: Wire onboarding** — in `complete-profile.tsx`:

Add state and imports:

```tsx
import { Checkbox } from '../../components/primitives';
import { CURRENT_TERMS_VERSION } from '@cultuvilla/shared/models/user';
import { serverTimestamp } from '@cultuvilla/shared/firebase';
import { Link } from 'expo-router';
// …
const [acceptedTerms, setAcceptedTerms] = useState(false);
```

> Note: `serverTimestamp` must be re-exported from `@cultuvilla/shared/firebase` (the
> service-layer rule forbids importing `firebase/firestore` in a screen). If it isn't
> already exported there, add the re-export in that barrel as part of this step and note
> it in the commit.

Pass to `PersonForm`:

```tsx
        consentSatisfied={acceptedTerms}
        renderConsent={() => (
          <Checkbox
            value={acceptedTerms}
            onValueChange={setAcceptedTerms}
            testID="accept-terms"
            label={
              <Text>
                {t('onboarding.completeProfile.acceptPrefix')}{' '}
                <Link href="/legal/terms"><Text tone="accent">{t('menu.terms')}</Text></Link>
                {' '}{t('common.and')}{' '}
                <Link href="/legal/privacy"><Text tone="accent">{t('menu.privacy')}</Text></Link>
              </Text>
            }
          />
        )}
```

In `onSubmit`, stamp consent on the create branch only:

```tsx
      if (profile) {
        await patchUserProfile(user.uid, profilePatch);
      } else {
        await createUserProfile(user.uid, {
          email: user.email ?? '',
          ...profilePatch,
          termsAcceptedAt: serverTimestamp() as unknown as Date,
          termsVersion: CURRENT_TERMS_VERSION,
        });
      }
```

(The `serverTimestamp()` sentinel is written through the converter-bypassing raw setDoc
in `createUserProfile`; the `as unknown as Date` bridges the `ClientUserInput` type to the
FieldValue sentinel, matching how `createdAt` is already handled server-side.)

- [ ] **Step 3: Add i18n strings** — in `packages/i18n/messages/es.json`, under
`onboarding.completeProfile` add `"acceptPrefix": "Acepto los"`, and under `common` add
`"and": "y"` (reuse if it already exists). Verify nesting matches the file.

- [ ] **Step 4: Verify the gate** — ASK USER TO RUN onboarding end-to-end:
  - Submit stays disabled on the final step until the box is checked.
  - Tapping the links opens the legal screens.
  - After accepting + submitting, the user doc has `termsAcceptedAt` + `termsVersion: "1.0"`.

- [ ] **Step 5: Run mobile typecheck + tests**

Run: `pnpm app:typecheck` and `pnpm app:test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile packages/i18n
git commit -m "feat(mobile): require terms acceptance to complete onboarding"
```

---

## Task 7: Un-stub the legal menu entries

**Files:**
- Modify: `apps/mobile/components/feature/UserMenuModal.tsx`

- [ ] **Step 1: Wire the two items** — replace the `comingSoon: true` legal items with
navigation, mirroring the admin item's `close(() => router.push(...))` pattern:

```tsx
        {
          icon: 'document-text-outline',
          label: t('menu.terms'),
          onPress: () => close(() => router.push('/legal/terms')),
        },
        {
          icon: 'shield-checkmark-outline',
          label: t('menu.privacy'),
          onPress: () => close(() => router.push('/legal/privacy')),
        },
```

- [ ] **Step 2: Verify** — ASK USER TO RUN: open the user menu → Legal → each item opens
the right screen.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/feature/UserMenuModal.tsx
git commit -m "feat(mobile): link legal menu entries to the new screens"
```

---

## Task 8: Backfill dev + verify conformance

**Files:**
- Create: `scripts/backfill-terms-acceptance.mjs`

- [ ] **Step 1: Write the script** — mirror `scripts/backfill-municipality-namelower.mjs`
(project-id guard, idempotent, batched). Patch only `users` docs missing `termsVersion`,
setting `termsVersion: '1.0'` and `termsAcceptedAt: <doc's existing createdAt>` (fall back
to `admin.firestore.FieldValue.serverTimestamp()` if `createdAt` is absent):

```js
const PROJECT_ID = 'villa-events';
// …guards identical to the reference script…
const snap = await db.collection('users').get();
for (const d of snap.docs) {
  const data = d.data();
  if (data.termsVersion) { alreadyCorrect++; continue; }
  batch.update(d.ref, {
    termsVersion: '1.0',
    termsAcceptedAt: data.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
  });
  // …batch commit at 400…
}
```

- [ ] **Step 2: Run the backfill against dev** (autonomous — dev only)

Run: `GOOGLE_APPLICATION_CREDENTIALS=<dev key> node scripts/backfill-terms-acceptance.mjs`
Expected: reports patched vs already-correct counts. (See `firebase-admin-dev` skill for
the credentials path.)

- [ ] **Step 3: Verify conformance**

Run: `pnpm check:dev-conformance`
Expected: no nonconforming `users` docs (the converter now requires the consent fields).

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-terms-acceptance.mjs
git commit -m "chore(scripts): backfill terms-acceptance fields on dev users"
```

---

## Task 9: Docs + services map + CHANGELOG

**Files:**
- Modify: `packages/shared/src/services/_services-map.md`, `CHANGELOG.md`

- [ ] **Step 1: Update the services map** — note that `createUserProfile` now writes
`termsAcceptedAt` + `termsVersion` on the `users` doc.

- [ ] **Step 2: CHANGELOG** — add under `## [Unreleased]`:

```
- Terms of Use + Privacy Policy: acceptance now required at onboarding; versioned
  acceptance stored per user; documents readable from the user menu.
```

- [ ] **Step 3: Run the full gate**

Run: `pnpm check`
Expected: PASS (lint + typecheck + test + build). Emulator-backed suites: ASK USER TO RUN.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/services/_services-map.md CHANGELOG.md
git commit -m "docs: record terms-acceptance in services map and changelog"
```

- [ ] **Step 5: Deploy rules to dev** via the `firestore-deploy` skill (rules only), then
open the PR to `develop` per the AGENTS.md workflow.

## Resolved

- **Retention:** data kept while the account is active; deleted or anonymized when the
  user deletes their account; audit/legal logs retained only for the legally-required
  minimum.
- **Minimum age:** 14 (Spanish LOPDGDD digital-consent threshold); under-14s require
  parental/guardian consent.

## Out of scope (v1.0)

- Re-acceptance gate when `termsVersion` bumps (whole-app re-prompt vs next-login only).
  The versioned record is stored now so this can be built later; revisit when the first
  version bump lands.
