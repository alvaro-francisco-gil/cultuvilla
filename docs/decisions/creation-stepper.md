# Shared multi-step Stepper for field-heavy creation flows

## Context

The creation screens (profile, persona a tu cargo, event) were long single-page
forms. We wanted the multi-step "wizard" UX from the sibling `ordago-apps`
project, but ordago's stepper is not a reusable component — it is a pattern
copy-pasted across three flows, built on plain React Native `StyleSheet` + React
Navigation and themed with a hardcoded green palette. cultuvilla is a different
stack (Expo Router, NativeWind, its own primitives), so the ordago files could
not be reused directly.

## Decision

- **One shared `Stepper` + `StepIndicator`** under
  `apps/mobile/components/feature/`, built only from existing primitives
  (`Button`, `Pressable`, `Text`, `HStack`, `View`) and themed with the semantic
  `accent` (terracotta) token — never raw colors or ordago's green. The
  `Stepper` owns only step-cursor state (`current` + `highestReached`); all form
  data stays in the calling screen, passed in as `StepConfig[]`
  (`{ key, title, render, validate }`).
- **Renders one step at a time — no horizontal swipe-paging.** ordago's
  swipe-paging `ScrollView` and its `Alert.alert`-on-invalid popups were
  deliberately **not** ported: both misbehave on cultuvilla's RN-Web build
  (see [[mobile-app-scaffold]] / the RN-Web gotchas). Behavior is identical on
  native and web.
- **Invalid step simply disables the Next button** — no per-field inline error
  messages, no popups. `validate()` returns a `string[]`; a non-empty array
  disables Next. This was a chosen simplification over surfacing which field is
  missing.
- **Profile and Persona share one `PersonForm`.** Profile
  (`(onboarding)/complete-profile.tsx`) previously had its own duplicated inline
  form; it now renders the same `PersonForm` as persona a tu cargo
  (`person/[personId].tsx`), which carries a `requireFullName` flag (Profile
  passes it; Persona does not). `PersonForm` renders as three steps: Identidad /
  Origen y residencia / Sobre ti.
- **Telephone is not collected at profile creation**, and **active village is
  derived from residence** (`activeMunicipalityId = residence municipalityId`),
  removing the separate account-village picker. Telephone is intended to be
  collected later, at event registration, only when an event requires it.
- **Only field-heavy flows use the stepper.** News, Start village, and Organizer
  request stay single-form — too few fields to justify a wizard.

## Rejected alternative

- **Fork ordago's per-flow stepper files.** Rejected: wrong stack (StyleSheet +
  React Navigation vs NativeWind + Expo Router), and it bakes in the swipe-paging
  and Alert popups that break on RN-Web.
- **Per-field inline validation errors.** Rejected for now in favor of the
  simpler disable-Next gate; can be revisited if users find a disabled Next
  unclear.
- **Merge Profile + Persona into a heavier form with optional sections.** Became
  unnecessary once residence was wanted in both and telephone was dropped from
  profile creation — the field sets converged, so the existing `PersonForm` (plus
  `requireFullName`) sufficed.

## What this binds

- New multi-step creation flows should reuse `Stepper`/`StepConfig`, not
  hand-roll navigation. Keep gating as disable-Next; do not add `Alert` popups or
  swipe-paging.
- `PersonForm` is the single source for person identity fields; do not
  reintroduce a parallel inline person form on another screen.

## Revisit when

- A creation flow genuinely needs per-field error messaging, or a step that the
  user must be able to skip-and-return-to in a non-linear way.
- Telephone-at-event-registration is implemented (the deferred half of dropping
  telephone from profile creation).
