# Añadir difuntos a un cementerio

## Problem

A cemetery is a `place` with `kind === 'cemetery'`; a buried person is an ordinary
`person` doc whose `burialPlace = { municipalityId, placeId }` points at that
cemetery. The cemetery detail screen already *reads* and displays buried personas
via `getPersonsByBurialPlace(placeId)`, but there is **no UI to add one** —
`PersonForm` never exposes `burialPlace`/`deathDate`, and no screen writes them.

The goal: let **any** logged-in user (not only village admins) mark one of **their
own personas a cargo** as buried in a cemetery, optionally recording an approximate
death date.

## Key constraints (why this is small)

- **No rule change.** The persons write rule already restricts `burialPlace`/`deathDate`
  writes to the person's creator/owner (`createdBy == uid && userId == null`) or an
  app admin — which is exactly "persona a tu cargo". Village admins have *no* write
  path to person docs, so there is no admin gate to remove.
- **No schema change.** `deathDate: PartialDate | null` and
  `burialPlace: { municipalityId, placeId } | null` already exist on `PersonData`
  and are well-shaped (independent nullables).
- **No service change.** Uses existing `updatePerson`, `getPersonsByCreator`,
  `getPersonsByBurialPlace`.
- **Death date never enters the general persona stepper.** It is captured *only*
  inside the cemetery-add flow.

## Flow

1. **FAB** on the cemetery detail screen
   ([apps/mobile/app/village/[villageId]/place/[placeId].tsx](../../../apps/mobile/app/village/%5BvillageId%5D/place/%5BplaceId%5D.tsx)),
   rendered only when `place.kind === 'cemetery'` and the user is logged in. A
   single-CTA pill styled like `RegisterFab` ("＋ Añadir difunto"). Not gated on
   admin.
2. Tapping opens **`BuriedSheet`** (mirrors `AttendeeSheet`'s web-safe `Modal`
   pattern), which has two phases:
   - **Pick phase:** lists the caller's personas a cargo
     (`getPersonsByCreator(uid).filter(d => d.userId === null)`), marking any already
     buried here. Plus a dashed **"Crear nueva persona"** row → `router.push('/person/new')`.
     On focus-return the freshly created persona appears in the list (same
     create-new-then-return pattern as event signup).
   - **Date phase:** after a persona is picked, show a gentle heading
     *"Lamentamos tu pérdida"* + a **`PartialDateField`** (segmented year / month /
     day, **all optional** — year alone suffices, or none at all) + an "Añadir"
     button. A difunto may be added with no date.
3. Confirm → `updatePerson(personId, { burialPlace: { municipalityId, placeId }, deathDate })`
   (`deathDate` is the PartialDate or `null`).
4. Sheet closes; the cemetery screen **reloads its buried list on focus**
   (`useFocusEffect`) so the new difunto appears immediately.

## Components to build

### `PartialDateField` (new primitive)
`apps/mobile/components/primitives/PartialDateField.tsx`

A sibling of `BirthDateField` reusing its segmented year/month/day selector UI, but:
- `value: PartialDate | null`, `onChange: (d: PartialDate | null) => void`.
- Emits partials: year-only → `{ year, month: null, day: null }`; year+month → day
  stays `null`; clearing all → `null`. (Contrast `BirthDateField`, which emits `null`
  unless all three are set.)
- Day options recompute from year+month when both present; otherwise 1–31.

Colocated jest test covering: year-only, year+month, full, and cleared cases.

### `BuriedSheet` (new feature component)
`apps/mobile/components/feature/BuriedSheet.tsx`

Two-phase bottom `Modal` following `AttendeeSheet` conventions (styles on
`style`/`className`, `insets.bottom` padding, `window`-safe on RN-Web). Props:
`visible`, `personas: { id, name, buriedHere }[]`, `busy`, `autoSelectId?`,
`onClose`, `onCreateNew`, `onConfirm(personId, deathDate)`. Selecting a persona
advances to the date phase; "Añadir" fires `onConfirm`.

### `BuryFab` (new feature component)
`apps/mobile/components/feature/BuryFab.tsx`

Thin `RegisterFab`-style single pill. Loads the caller's personas a cargo on focus
(`getPersonsByCreator` filtered to `userId === null`, cross-referenced against the
current buried list to mark `buriedHere`), owns the `BuriedSheet`, and on confirm
calls `updatePerson` then triggers the parent's reload. Props: `municipalityId`,
`placeId`, `userId`, `onChanged`.

### Wiring
`place/[placeId].tsx`: mount `<BuryFab>` when `place.kind === 'cemetery'` and
`user != null`; convert the buried-persons load into a `useFocusEffect`/callback so
`onChanged` re-runs it.

### i18n
`packages/i18n/messages/es.json`, `cemetery.*` namespace:
`cemetery.addDifunto`, `cemetery.condolence` ("Lamentamos tu pérdida"),
`cemetery.deathDatePrompt`, `cemetery.deathDateOptional`, `cemetery.createPersona`,
`cemetery.alreadyBuried`, `cemetery.add`. Consumed via `useT()`.

## Out of scope

- Editing/removing a burial from the cemetery screen (the person owner can still
  clear `burialPlace` by other means later; not part of this change).
- Death date in the general persona edit form.
- Multi-select (each difunto is added one at a time — `deathDate` is per person).

## Testing

- `PartialDateField` unit test (jest) — partial emission cases.
- `BuriedSheet` interaction test (jest) — pick → date phase → confirm payload;
  create-new callback; already-buried marking.
- `BuryFab` — filters personas to `userId === null`; confirm calls `updatePerson`
  with the right `burialPlace`; reload fires.
- Burial read path (`getPersonsByBurialPlace`) already covered.

## Verification

Drive the dev-client AVD: open a cemetery place, tap the FAB, create a new persona,
return, pick it, add with year-only date, confirm, see it in the buried list.
