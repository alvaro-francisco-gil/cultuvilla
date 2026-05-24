# Auth & persona onboarding redesign

## Background

Today the mobile app has a thin signup flow and a placeholder "complete-profile" screen, and the `User` model duplicates persona-shaped fields:

- `apps/mobile/app/(auth)/signup.tsx` — email + password only.
- `apps/mobile/app/(auth)/login.tsx` — email + password, even though `AuthContext` already supports Google sign-in.
- `apps/mobile/app/(onboarding)/complete-profile.tsx` — writes `users/{uid}` with `displayName`, `birthday` (parsed from a `DD/MM/AAAA` text field), and optional `telephone`. It never touches the `Person` collection and never sets `users/{uid}.personId`.
- `UserData` (`packages/shared/src/models/user/UserDataModel.ts`) holds `biography`, `photoURL`, and `birthday: Date` — fields that already exist (and belong) on `PersonData`.
- The redirect gate in `apps/mobile/app/_layout.tsx` triggers onboarding only when `profile == null`. A user who has a `UserData` doc but no linked `Person` skips persona creation entirely.

The result: persona creation does not exist as a user-visible step, and the data model carries two homes for the same fields.

## Goals

1. Make `User` strictly account/auth metadata and move all persona-shaped fields to `Person`.
2. Add a real persona-creation step to the onboarding flow that creates a `Person` and links it from `users/{uid}.personId`.
3. Replace ad-hoc inputs (text-parsed birthday, no photo) with proper pickers (DateTimePicker, image picker, village picker).
4. Surface auth options that already exist in code but aren't in the UI (Google sign-in, password reveal, forgot-password).
5. Ensure existing accounts without a `personId` get routed through the new persona step.

## Non-goals

- GPS-coordinate / map-based location picker. "Location" in this round means **village** (a link to an existing `municipalities/{id}` doc).
- Multi-step wizard UX. A single scrollable screen with two sections is enough for v1.
- Custom avatar cropping beyond what `expo-image-picker` offers.
- Profile-edit screen (post-onboarding). Out of scope; tracked separately.

## Data model changes

### `UserData` — slim down to account metadata

Remove `biography`, `photoURL`, and `birthday`. Keep:

```ts
export interface UserData {
  displayName: string                      // cached label for headers/avatars
  email: string
  telephone: string | null
  activeMunicipalityId: string | null
  personId: string | null
  createdAt: Date
}
```

`displayName` stays on `User` as a cached system label so headers/menus don't need to join `Person` on every render. It's seeded from the persona at creation time and re-synced on persona update.

Update `UserDataInput`, `buildUserData`, `userService` types, and any tests referencing the dropped fields.

This is a breaking change to the `users/*` document shape. The dev Firestore project has no production users, so we drop the fields without a migration. Any existing dev docs that still carry them will be ignored on read.

### `Person` — no schema change

`PersonData` already covers everything we need: name parts, `sex`, `birthday: PartialDate | null`, `birthPlace: MunicipalityLink | null`, `biography`, `photoURL`, `municipalityLinks`, `userId`, `createdBy`.

The persona-creation screen writes exactly these fields. No new fields are added.

## Onboarding flow

### Routing gate

`apps/mobile/app/_layout.tsx`:

```diff
- const needsOnboarding = !!user && profileChecked && !profile;
+ const needsOnboarding =
+   !!user && profileChecked && (!profile || !profile.personId);
```

So an account that has a `users/{uid}` doc but no linked `Person` still lands on `/(onboarding)/complete-profile`.

### Screen layout

One screen, two visible sections. Single scroll. Submit button at the bottom commits both writes atomically from the client's point of view (account write → persona write → personId patch — see "Write order" below).

```
┌─────────────────────────────────────────┐
│ Tu cuenta                               │
│ ┌─────────────────────────────────────┐ │
│ │ Nombre visible*           [______]  │ │
│ │ Teléfono                  [______]  │ │
│ │ Tu pueblo                 [Picker ▾]│ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Tu persona                              │
│ ┌─────────────────────────────────────┐ │
│ │            ⭕  (tap to add photo)    │ │
│ │ Nombre*                   [______]  │ │
│ │ Primer apellido           [______]  │ │
│ │ Segundo apellido          [______]  │ │
│ │ Apodo                     [______]  │ │
│ │ Sexo                      [○○○]     │ │
│ │ Fecha de nacimiento       [Picker]  │ │
│ │ Lugar de nacimiento       [Picker ▾]│ │
│ │ Biografía                 [______]  │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│           [   Crear perfil   ]          │
└─────────────────────────────────────────┘
```

Required: `displayName` (account) and `givenName` (persona). Everything else is optional.

### Write order

On submit:

1. **Create the persona first.** `createPerson({ ...input, createdBy: uid, userId: uid })` → returns `personId`.
2. **Upload avatar** (if picked) to Storage at `persons/{personId}/avatar.jpg`. Patch `persons/{personId}.photoURL` with the resulting URL.
3. **Create the account doc.** `createUserProfile(uid, { displayName, email, telephone, activeMunicipalityId, personId })`.
4. `refreshProfile()` → router replaces to `/(tabs)`.

Persona-first means a failure between step 1 and step 3 leaves an orphaned `Person` (recoverable: next attempt re-uses it via `users/{uid}.personId == null` plus a lookup by `persons.where(userId == uid)`). The reverse order would leave a half-created account with no persona, which is exactly the bug we're fixing.

### Existing users without a `Person`

Same screen, same flow. `displayName` and `telephone` are prefilled from `profile` if present. On submit the existing `users/{uid}` doc is **patched** (not re-created) so we don't clobber `createdAt`, `activeMunicipalityId`, etc.

`userService` needs a `patchUserProfile(uid, partial)` helper if it doesn't already have one. (Check during implementation; add if missing.)

## Auth-screen polish

### Login (`apps/mobile/app/(auth)/login.tsx`)
- Surface the existing `signInWithGoogle()` as a button.
- Password field uses the new `PasswordInput` primitive (reveal toggle).
- "¿Olvidaste tu contraseña?" link → calls `sendPasswordResetEmail(getAuth(), email)`, shows a confirmation toast/text.

### Signup (`apps/mobile/app/(auth)/signup.tsx`)
- Surface `signInWithGoogle()` as a button (single Google button handles both — Firebase treats it as sign-in either way).
- `PasswordInput` with reveal.
- Inline hint: "Mínimo 6 caracteres" under the password field.

No other restructuring — signup remains email + password only. Persona creation stays in onboarding.

## New shared primitives

Add under `apps/mobile/components/primitives/`:

- **`Avatar`** — circular image (or initials fallback) with an optional `onPress` to swap. Used in the persona section and reusable for headers later.
- **`DateField`** — label + `@react-native-community/datetimepicker` wrapper. Returns a JS `Date` or `null`. The persona screen converts to `PartialDate` on submit.
- **`PasswordInput`** — `Input` with `secureTextEntry` plus an eye toggle on the right.
- **`VillagePicker`** — searchable list of municipalities (driven by `municipalityService.listMunicipalities` or equivalent — confirm exact API at implementation time). Returns a `municipalityId` (and `barrioId: null` for the account-level field; `MunicipalityLink` for `birthPlace`).

All four go through `apps/mobile/components/primitives/index.ts`.

## Dependencies

Add to `apps/mobile/package.json`:

- `@react-native-community/datetimepicker` — Expo-compatible, native dialog on iOS/Android.

`expo-image-picker` is already installed.

After installing, run the `expo-native-rebuild` skill — `datetimepicker` includes native code.

## i18n

New keys live in the shared catalog under `packages/i18n/`. Namespaces:

- `auth.*` — `forgotPassword`, `forgotPasswordSent`, `passwordHint`, `showPassword`, `hidePassword`, `continueWithGoogle`.
- `onboarding.completeProfile.*` — section headings (`accountSection`, `personaSection`), field labels for every persona field (`givenName`, `firstSurname`, `secondSurname`, `nickname`, `sex`, `sexMale`, `sexFemale`, `sexOther`, `birthday`, `birthPlace`, `biography`), `addPhoto`, `changePhoto`.

Strings authored in Spanish + English per the existing catalog convention. See `i18n-add-string` skill at implementation time.

## Firestore rules

`Person` documents are written client-side during onboarding. Confirm `firestore.rules` allows:

- `create` on `persons/{personId}` when `request.auth.uid == request.resource.data.userId == request.resource.data.createdBy`.
- `update` on the freshly-created doc for the `photoURL` patch following the Storage upload.

If the rule is missing or stricter, either relax it or route the create through a Cloud Function. Defer that decision to the implementation plan — run the `guardrail-enforcement` skill once we know which path.

Storage rules: confirm `persons/{personId}/avatar.jpg` is writable by `request.auth.uid == userId-of-persona`. If the path can't be authorized purely from the resource, switch to `users/{uid}/avatar.jpg` and store that URL on the persona instead.

## Validation rules

- `displayName.trim().length > 0` — required.
- `givenName.trim().length > 0` — required.
- `birthday` (if provided) — date must be in the past and after 1900-01-01.
- `telephone` — no format enforcement at this layer (Spain has too many valid shapes); just trim.
- `biography` — soft cap 1000 chars (hint shown, not enforced server-side in this pass).

## Test plan

`packages/shared`:

- `buildUserData` — only emits the slimmed fields; dropped fields aren't present on output.
- `userService.patchUserProfile` (if added) — patches without overwriting `createdAt`.
- `personService.createPerson` — round-trips through Firestore emulator with `userId` set.

`apps/mobile`:

- Persona screen renders all fields, marks required ones, refuses submit if `displayName` or `givenName` blank.
- Persona screen submits in the documented write order (mock `personService` + `userService`, assert call sequence).
- Login screen: Google button visible, password reveal toggles `secureTextEntry`, forgot-password calls `sendPasswordResetEmail`.

`firestore.rules` (rules-unit-testing harness): allow/deny matrix for `persons/{personId}` create + update covering the cases above.

## Open items to resolve during planning

1. Exact `municipalityService` query shape for `VillagePicker` (search vs full-list-then-filter).
2. Whether `userService` already has a patch helper or one needs adding.
3. Final Firestore-rule shape for `persons/{personId}` create — defer to `guardrail-enforcement`.

These don't block the design; they shape the implementation plan.
