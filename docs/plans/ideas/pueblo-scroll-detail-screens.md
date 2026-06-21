# Pueblo-tab scroll detail screens

**Goal:** Make every card in every village-tab ("pueblo") scroll open a read-only detail screen for all users, the way Eventos already opens `/event/[id]`.

## Context

The village tab (`apps/mobile/app/(tabs)/village.tsx`) renders several horizontal scrolls: Próximos eventos, Barrios, Lugares, Agrupaciones, Peñas. Today only Eventos is tappable for everyone. The other four navigate to the **admin management** screens and only do so when the viewer is an admin (`canManage`); non-admins tap dead cards.

The user wants parity with events/news: every item is a doorway into a detail screen, for everyone.

## Approach

### Navigation model

Card tap → **public detail screen** for everyone, including admins. Admins keep their management path via each section header's existing "Gestionar" / "+" affordances (`onManage` / `onAdd`), which stay exactly as they are. Tapping a *card* always means "show me this thing", never "manage this thing".

### Per-scroll changes

| Scroll | Today | After |
|---|---|---|
| Próximos eventos | → `/event/[id]` (everyone) | unchanged |
| Agrupaciones | → admin list (admins only) | → existing `/o/[orgId]` (everyone) |
| Peñas | → admin list (admins only) | → existing `/o/[orgId]` (everyone) |
| Barrios | → admin list (admins only) | **new** `/village/[villageId]/barrio/[barrioId]` (everyone) |
| Lugares | → admin list (admins only) | **new** `/village/[villageId]/place/[placeId]` (everyone) |

Agrupaciones/Peñas are a pure wiring fix — the org detail screen at `app/o/[orgId].tsx` already exists and already handles the public/join view. We just change the card `onPress` from the admin-gated management route to `/o/${o.id}` unconditionally.

### New routes (nested so both ids are in the path)

`villageId` **is** the `municipalityId`. Barrios and places are subcollection docs (`/municipalities/{id}/barrios/{barrioId}`, `/municipalities/{id}/places/{placeId}`), so the detail screen needs both ids. Nesting under the existing `village/[villageId]/` folder (which already holds `censo.tsx`, `organizations.tsx`) supplies both cleanly, with no query-param hacks:

- `apps/mobile/app/village/[villageId]/barrio/[barrioId].tsx`
- `apps/mobile/app/village/[villageId]/place/[placeId].tsx`

### Detail screen contents

**Barrio** — header (photo, name) + **residents**: people linked to this barrio. Each resident row taps through to `/person/[personId]`. Empty state when there are no residents.

**Lugar** — header (photo, name, localized kind label, description). When `kind === 'cemetery'`, also a **buried-here** list of people, each tapping through to `/person/[personId]`. Non-cemetery kinds (church, hermitage, plaza, town_hall) show the header only — no person link exists for them.

Both screens mirror the load/error/empty structure of the existing detail screens (`app/o/[orgId].tsx`, `app/event/[eventId].tsx`): `ActivityIndicator` while loading, `common.notFound` when the doc is missing, `AppHeader` with the entity name as `centerLabel`.

### Why the people queries are cheap

- **Barrio residents:** `MunicipalityLink` is exactly `{ municipalityId, barrioId }` (see `PersonDataModel.MunicipalityLinkSchema`), so an exact-object `array-contains` query works:
  `where('municipalityLinks', 'array-contains', { municipalityId, barrioId })`.
- **Cemetery burials:** `burialPlace` is a single nested object, so `where('burialPlace.placeId', '==', placeId)` works directly.

Neither needs denormalization. Results are ordered client-side by display name (a village has few persons per barrio/cemetery), or by an `orderBy` if it doesn't force a composite index — TBD-free: default to client-side sort to avoid index churn, matching the `getPlaces` "few rows, sort in memory" precedent.

### New shared-service functions

In `municipalityService.ts` (follow `touch-service` conventions — JSDoc, converter refs, re-export through `services/index.ts` and update `_services-map.md`):
- `getBarrio(municipalityId, barrioId): Promise<(BarrioData & { id }) | null>`
- `getPlace(municipalityId, placeId): Promise<(PlaceData & { id }) | null>`

In `personService.ts`:
- `getPersonsByBarrio(municipalityId, barrioId): Promise<(PersonData & { id })[]>`
- `getPersonsByBurialPlace(placeId): Promise<(PersonData & { id })[]>`

### Cross-cutting work

- **Firestore rules:** confirm `persons` is publicly readable (the two new queries run for any viewer). If reads are already open, no change; if gated, add the read allowance.
- **Firestore indexes:** add composite indexes only if the chosen query shape requires one. Default query shapes (single `array-contains`, single equality, no `orderBy`) need none.
- **i18n:** new strings for the barrio/place screens (residents heading, buried-here heading, empty states). Reuse existing place-kind labels if they already exist in the admin places screen; otherwise add them under the places namespace.
- **Tests:** vitest coverage for the four new service functions in `packages/shared`.

## Out of scope

- Deep-link share buttons for barrios/places. Events and orgs have share/invite buttons backed by `deepLinkService`; adding new deep-link types is separate work.
- Editing from the detail screen. Barrio/place detail stays read-only; all editing remains in the admin screens.
- Showing residents on non-cemetery places or any new person↔place relationship beyond the two that already exist in the data model.
