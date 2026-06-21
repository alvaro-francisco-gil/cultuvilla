# Auth flow & persona-first onboarding

## Context

The account model splits cleanly into `users/{uid}` (account metadata) and
`persons/{personId}` (the persona — see [persons-registry](persons-registry.md)).
Onboarding had to create both, and the auth screens needed a real sign-in story.
The original redesign plan assumed email + password auth (with password reveal and
a forgot-password reset flow) and proposed slimming the persona display fields off
`UserData`. Implementation diverged on both points.

## Decision

- **Passwordless email-link auth, not password auth.** Sign-up and sign-in send a
  Firebase email sign-in link; `(auth)/finish.tsx` completes the link. Google
  sign-in is the only alternative. There is no password field and no
  forgot-password/reset flow anywhere in the app.
- **Onboarding writes the persona first, then the account.** `complete-profile`
  is one scrollable screen with a persona section and an account section. It
  `createPerson(...)` → uploads the avatar → `createUserProfile`/`patchUserProfile`
  with the resulting `personId`. The onboarding gate fires on `!profile?.personId`,
  so an existing account without a persona is routed back through it (and an
  orphaned persona is recovered via `getPersonByUserId`).
- **`UserData` keeps `birthday`, `biography`, `photoURL` as denormalized display
  fields** rather than being slimmed to pure account metadata. `buildUserData`
  defaults them to `null`; `displayName` is kept fresh from the linked person via
  the `syncPersonDenormalization` Cloud Function trigger.

## Rejected alternatives

- **Email + password with a reset flow.** Built then dropped — email-link removes
  password storage/reset UX entirely. The `PasswordInput` primitive survives as a
  generic, currently-unused component; the password-reset i18n keys and
  `ForgotPasswordLink` were deleted as dead code.
- **Slimming persona fields off `UserData`.** Rejected to avoid a join/read on
  every place that shows a user's name or avatar, and to avoid backfilling every
  pre-existing user doc. The strict converter reads pre-field docs by defaulting
  the missing fields, so no backfill was needed.

## What this binds

- New auth UI must go through the email-link / Google paths — do not reintroduce a
  password field without revisiting this decision.
- Onboarding completion is defined by `personId` being set, not by `profile`
  existing. Code that checks "is the user onboarded" must check `personId`.
- `displayName` on `users` is denormalized — write it through the person + trigger,
  not by hand. The other denormalized fields (`birthday`/`biography`/`photoURL`)
  are display copies, not the source of truth; the person record is canonical.

## Revisit when

- A requirement forces password auth (e.g. an integration that can't do email-link).
- The denormalized `UserData` fields drift from their person source often enough to
  justify either a sync trigger for them too or removing them in favour of a join.
