# Creation Stepper

## Goal

Introduce one shared multi-step "stepper" component, inspired by the ordago-apps
creation wizard but rebuilt on cultuvilla's primitives and design tokens, and
refit the field-heavy creation screens (Profile, Persona a tu cargo, Event) onto
it.

## Context

ordago-apps has a well-liked creation wizard, but it is not a single shared
component — it is a pattern copy-pasted across three flows
(`CreateMatchStepper`, `CreateTournamentStepper`, `CreateOrganizerStepper`),
assembled from `CustomStepIndicator` (icon dots + connectors),
`StepperNavigation` (Back/Next/Finish footer) and a horizontal paging
`ScrollView`. It is plain React Native `StyleSheet` + React Navigation, themed
with a hardcoded green palette.

cultuvilla is a different stack: Expo Router, NativeWind (`className`), and its
own primitives (`Screen`, `VStack`, `HStack`, `Button`, `Input`, `Text`). So we
cannot copy ordago's files — we reproduce the *UX* (step indicator + one-step-at-
a-time content + Back/Next footer + per-step validation) as a single reusable
cultuvilla component, themed with the existing `accent` (terracotta) token rather
than ordago's green.

Two ordago mechanics are deliberately **not** ported, because both are known to
misbehave on cultuvilla's RN-Web build (see memory `project_alert_on_web` and
`project_animated_view_className`):

- horizontal swipe-paging `ScrollView` between steps, and
- `Alert.alert` popups on invalid Next.

## Design / approach

### The shared component (new, under `apps/mobile/components/feature/`)

- **`Stepper`** — the container. Renders a `StepIndicator` at the top, the
  **current step's content only** (no horizontal swipe), and a footer. Owns
  `currentStep` and `highestStepReached` state. Data stays in the calling
  screen — the stepper does not own field state.

  Props:
  - `steps: StepConfig[]`
  - `onComplete: () => void | Promise<void>` — called by the primary button on
    the last step
  - `submitLabel: string` — label of the primary button on the last step (e.g.
    "Crear evento", "Guardar")
  - `loading?: boolean` — disables the footer + shows spinner during submit
  - `submitError?: string | null` — rendered above the footer

- **`StepConfig`**:
  ```ts
  interface StepConfig {
    key: string;
    title: string;             // shown as the step heading
    icon?: string;             // optional indicator icon name
    render: () => ReactNode;   // the step's fields, using existing primitives
    validate?: () => string[]; // [] = valid; non-empty = blocks forward nav
  }
  ```
  Each screen owns its field state with the same `useState` pattern used today
  and supplies `render` + `validate` per step.

- **`StepIndicator`** — numbered/icon dots joined by connector lines.
  - completed & current dots: `bg-accent` / `border-accent` (terracotta),
    `text-on-accent`
  - locked (not-yet-reached) dots: `bg-subtle` + `text-muted` (sage),
    `border-subtle`
  - connectors: `border-subtle`, switching to `border-accent` once the step on
    the right has been reached
  - tapping a dot for a **visited** step (`index <= highestStepReached`) jumps
    there; tapping a forward dot first runs the current step's `validate()` and
    only advances if it passes.

- **Footer** — `HStack` with:
  - `Atrás` — `ghost` `Button`, hidden on the first step (rendered with
    `opacity-0` placeholder to preserve layout, matching ordago).
  - primary — `primary` `Button`. On non-final steps it is `Siguiente` and
    advances after `validate()`; on the final step it is `submitLabel` and calls
    `onComplete`. **Disabled whenever the current step's `validate()` is
    non-empty.**
  - No `Alert`, no swipe — identical behaviour on native and web.

State model mirrors ordago's `currentStep` + `highestStepReached` (the latter
controls which dots are tappable), but all form data lives in each screen.

### Validation & errors

Per-step `validate()` drives two things: the disabled state of the Next/primary
button, and inline field errors. Errors surface inline under each field via the
existing `Input` error affordance — never as popups. Final-submit failures render
via `submitError` above the footer.

### Screens that adopt the stepper

| Screen | Route | Steps |
|---|---|---|
| Profile (self) | `(onboarding)/complete-profile.tsx` | via shared `PersonForm` |
| Persona a tu cargo | `person/[personId].tsx` (`new`/edit) | via shared `PersonForm` |
| Event | `event/new.tsx` | 3 (below) |

**PersonForm** (shared by Profile + Persona, ~11 fields) is refactored to emit
three steps:
1. **Identidad** — photo, given name, first surname, second surname, nickname,
   sex
2. **Origen y residencia** — birthday, birthplace (`VillagePicker`), residence
   municipality + barrio (`VillagePicker` + `BarrioPicker`)
3. **Sobre ti** — biography

Both screens get the stepper for free because they already share `PersonForm`.

**Event** (`event/new.tsx`, ~9 fields) becomes three steps:
1. **Lo básico** — title, description, cover image
2. **Cuándo y dónde** — start date, end date, location
3. **Detalles** — organización, aforo máximo, teléfono-requerido toggle

Gating: step 1 requires title + description; step 2 requires a start date.
(Existing eligibility/loading states — active-municipality check, membership
fetch — wrap the stepper unchanged, exactly as they wrap today's form.)

### Screens that stay single-form (too few fields for a wizard)

- **Noticia / News** (`news/new.tsx`) — title, body, category, images (~4
  fields). One screen.
- **Start village** (`discover/start/[municipalityId].tsx`) — ~3–4 fields. One
  screen.
- **Organizer request** (`discover/organize/[municipalityId].tsx`) — 1 field.
  One screen.

### Out of scope

- The inline "proposable" creators (Barrios, Organizations, Places) and the
  Censo schema editor — these are list-with-inline-add surfaces, a different
  shape from a wizard.
- A dark-mode palette for the stepper — the repo ships light mode only today;
  the stepper consumes semantic tokens so dark mode remains a future switch.

## Testing

- Vitest/RTL component tests for `Stepper`:
  - Next is disabled while the current step is invalid; enabled when valid
  - advancing past an invalid step is blocked; advancing a valid step works
  - back navigation works and never validates
  - visited dots are tappable, forward dots gate on validation
  - the primary button on the last step calls `onComplete`
- A smoke test per refitted screen (`PersonForm`, `event/new`) confirming all
  steps render and submit wires through.
- Follows the existing `__tests__` pattern in
  `apps/mobile/components/primitives/__tests__`.

## Open questions

None — resolved during brainstorming:
- "Without colors" means without *ordago's* green; the stepper uses cultuvilla's
  `accent` (terracotta) token.
- News stays single-form (confirmed).
- PersonForm step split Identidad / Origen+residencia / Sobre ti (confirmed).
