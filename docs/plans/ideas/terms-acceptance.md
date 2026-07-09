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

## File structure (to detail when promoting to `ready/`)

- **Modify:** `packages/shared/src/models/user/UserDataModel.ts`,
  `packages/shared/src/services/userService.ts`, `firestore.rules`,
  `apps/mobile/app/(onboarding)/complete-profile.tsx`,
  `apps/mobile/components/feature/UserMenuModal.tsx`,
  `apps/mobile/components/primitives/index.ts`, `packages/i18n/messages/es.json`
- **Create:** `apps/mobile/components/primitives/Checkbox.tsx` (+ test),
  `apps/mobile/app/(legal)/terms.tsx`, `apps/mobile/app/(legal)/privacy.tsx`,
  legal content module, `scripts/backfill-terms-acceptance.mjs`, shared-model test for
  the new fields
- **Docs:** `packages/shared/src/services/_services-map.md` if the write shape changes,
  CHANGELOG `[Unreleased]`

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
