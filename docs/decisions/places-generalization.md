# One `places` subcollection discriminated by `kind`

## Context

A cemetery was a municipality subcollection (`/municipalities/{id}/cemeteries/{id}`)
with the same ~8-file stack as `barrios` (model, converters, refs, service,
rules, tests, UI, i18n). Adding more notable-place types — churches, hermitages,
plazas, town halls — by copy-pasting that stack per type would multiply the
maintenance surface. The cemetery's one load-bearing trait is that it is the
target of `Person.burialPlace`.

## Decision

- A single **`/municipalities/{id}/places/{placeId}`** subcollection holds all
  notable sites, discriminated by a **`kind` enum**: `cemetery`, `church`,
  `hermitage`, `plaza`, `town_hall` (English identifiers, Spanish labels via
  i18n). One generalized `places.tsx` screen with a `kind` picker replaces the
  per-type screen.
- **`cemetery` is mandatory and load-bearing** — `Person.burialPlace =
  { municipalityId, placeId }` (renamed from `cemeteryId`) points at a place of
  `kind === 'cemetery'`. Cemetery semantics are preserved at the UI layer (the
  burial picker lists only `kind === 'cemetery'` places).
- **No `kind` composite index.** `getPlaces` fetches all places ordered by
  `name`; callers filter by `kind` in memory. A village has few places.

## Rejected alternatives

- **A stack per place type.** DRY violation — every new type would duplicate
  model/converter/service/rules/UI/i18n.
- **Generalizing `barrios` too.** A barrio is an administrative subdivision, not
  a physical site; it stays a separate subcollection on purpose.
- **A service-layer guard asserting `burialPlace` references a cemetery.** Left
  unbuilt — no write path sets `burialPlace` yet, so UI-level filtering of the
  burial picker is sufficient until one does.

## What this binds

- New notable-place types are added by extending the `kind` enum + i18n labels,
  not by creating a new collection.
- `burialPlace` carries `placeId`, not `cemeteryId`; the referenced place must be
  a cemetery (enforced by UI today, not by a server guard).

## Revisit when

- Place counts per village grow enough that in-memory `kind` filtering hurts —
  then add the `kind` composite index.
- A write path sets `burialPlace` programmatically (bypassing the picker) — then
  add the `kind === 'cemetery'` service/rules guard.
