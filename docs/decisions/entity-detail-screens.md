# "Entity" as a formal concept + shared detail scaffold

## Context

Six village-scoped domain objects (event, festival-poster, place, barrio,
organization, news) each appeared in a horizontal `Section` scroll as a
`BigCard` and opened a hero-image detail screen, but the six detail screens
had each hand-rolled their own header — four translucent icon buttons floating
over the flyer image — and the umbrella concept the code already leaned on
(`EntityCard`, `useEntityCapabilities`) was never formally defined.

## Decision

- **"Entity" is formally defined**: a village-scoped domain object that (a)
  appears in a horizontal `Section` scroll as a `BigCard`, and (b) opens a
  hero-image detail screen. `person` and `village` are explicitly **not**
  entities — they open into forms (`ScreenHeader`), not hero-detail screens.
- **One scaffold, `EntityDetailScaffold`**, composed of `EntityDetailHeader`
  (solid static top bar: back + action icons — replacing the translucent
  floating buttons), `DetailHeroImage`, then title + body. All six detail
  screens became thin consumers of this scaffold rather than independent
  implementations.
- The four `Floating*` header-button components were deleted outright
  (delete > deprecate) once every screen migrated off them.

## What this binds

- A new entity kind gets a detail screen by consuming
  `EntityDetailScaffold`, not by hand-rolling a header/hero layout.
- The per-kind fallback icon for `EntityCard`/scaffold usage lives in
  `apps/mobile/lib/entities/registry.ts` — extend that registry for a new
  entity kind, don't branch UI code on entity type ad hoc.
