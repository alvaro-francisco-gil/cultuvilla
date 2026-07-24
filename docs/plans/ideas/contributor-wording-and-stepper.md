# Contributor wording refresh + stepper creation flows

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
