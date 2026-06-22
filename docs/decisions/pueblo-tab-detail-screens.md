# Every pueblo-tab scroll opens a read-only detail screen

## Context

The village ("pueblo") tab renders horizontal scrolls of events, barrios,
lugares, agrupaciones and peñas. Only events were tappable; the other four
cards navigated to admin management screens and only when the viewer was an
admin, so non-admins tapped dead cards. The goal was parity with events/news:
every card is a doorway into a detail screen, for everyone.

## Decision

- **Card tap = public read-only detail, for every viewer including admins.**
  Admins keep their management path through each `Section` header's
  `onManage` / `onAdd` affordances (still `canManage`-gated). The per-card
  `onPress` is never gated. Tapping a *thing* means "show me the thing", never
  "manage the thing".
- **Organizations reuse the existing `/o/[orgId]` screen**; agrupaciones and
  peñas both route there. Barrios and lugares got new nested routes
  `app/village/[villageId]/{barrio,place}/[id].tsx` — nested because a
  barrio/place is a subcollection doc needing both `municipalityId`
  (= `villageId`) and its own id, and nesting supplies both without
  query-param hacks.
- **Linked people without denormalization.** A barrio detail lists residents;
  a cemetery lists the people buried there. Both are queried directly on the
  top-level `persons` collection:
  - residents — `where('municipalityLinks', 'array-contains', { municipalityId, barrioId })`.
    `MunicipalityLink` is exactly `{ municipalityId, barrioId }`, so exact-object
    `array-contains` works.
  - burials — `where('burialPlace.placeId', '==', placeId)` (dotted path on a
    single nested object).

## Rejected alternative

- **Denormalizing a queryable `barrioId` onto persons** (the pattern
  `_services-map.md` recommends when collection-group-querying `barrios`/`places`).
  Unnecessary here: we query the `persons` collection by *its own* fields, not
  the barrios/places subcollections, so the exact-object `array-contains`
  already gives an efficient single-constraint query.

## What this binds

- `getPersonsByBurialPlace(placeId)` is intentionally **not** scoped by
  municipality — `placeId` is a globally unique Firestore auto-id, so a bare
  match cannot collide across villages. Do not "fix" it by adding a
  municipality filter (it would force a composite index for no benefit).
- These queries need **no** `firestore.rules` change (`persons` is already
  `allow read: if isAuthenticated()`) and **no** composite index (single
  constraint, sort done in memory by `buildDisplayName`). Adding an `orderBy`
  to either query would require an index.
- The barrio/place detail screens are **read-only**; editing stays in the
  admin screens.

## Revisit when

- A barrio/place needs share/deep-link buttons (deferred — would add new
  deep-link types).
- A non-cemetery place needs a people list, or a new person↔place relationship
  is added (current screens only surface the two links that exist in the data
  model).
- Resident/burial lists grow large enough to need server-side ordering or
  pagination → then an index becomes worthwhile.
