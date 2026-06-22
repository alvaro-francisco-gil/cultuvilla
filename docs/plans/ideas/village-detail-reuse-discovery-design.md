# Reuse the pueblo-tab body for discovery's village detail

## Context

Two surfaces show "a village's home":

- The **pueblo tab** (`app/(tabs)/village.tsx`) renders the viewer's *active*
  village — hero, no-organizer banner, stats, share/invite, and five horizontal
  scrolls (events, barrios, lugares, agrupaciones, peñas) plus the censo link.
- The **discovery** flow (`app/discover` → `components/feature/VillageDiscovery.tsx`),
  reached from the profile's "Unirse a otro pueblo" and the menu's "Buscar otro
  pueblo", currently shows a flat list of municipalities and, on tap of an active
  one, pushes `app/village/[villageId]/index.tsx` — a *different*, thinner layout
  that does not match the pueblo tab.

The goal: when you tap a village in discovery, the pushed screen should look and
behave like the pueblo tab (same horizontal-scroll format), just inside a
back-navigable screen rather than a nav tab. And discovery itself should drop its
"Cargar todos" button in favour of infinite scroll, and visually distinguish
**awakened** (active community) from **dormant** municipalities.

This builds on [pueblo-tab-detail-screens](../../decisions/pueblo-tab-detail-screens.md)
(every card is a doorway to a read-only detail) and
[village-discovery-onboarding](../../decisions/village-discovery-onboarding.md)
(the middle tab swaps between active-village home and discovery).

## Decision

### 1. Extract the pueblo-tab body into a reusable hook + component

- **`useVillageHome(municipalityId: string | null)`** — a data hook holding all
  the loading currently inlined in `village.tsx`'s `loadVillage`: municipality,
  village-admin flag, my pending organizer request, barrios, places, members
  (→ `peopleCount` + `isMember`), upcoming published events, organizations +
  per-org member counts. Returns a single state object
  (`{ village, villageAdmin, isMember, barrios, places, organizations,
  orgMemberCounts, events, peopleCount, pendingOrganizerRequest, loadError,
  reload }`) and re-runs on `useFocusEffect`. Null `municipalityId` → empty state.
- **`<VillageHomeBody>`** — a presentational component taking the hook's data plus
  display flags. Renders the hero, the no-organizer wiki banner, stats,
  share/invite row, the five `Section` scrolls, and the censo link, and owns the
  `VillageInfoModal`. It contains **no data fetching** and **no header chrome**
  (no `AppHeader`, no `ScreenHeader`) — the host screen supplies those.
- `VillageSections.tsx` (ACCENT, Stat, StatSeparator, Section, EntityCard,
  PersonCard, AddCard, SettingsLink) is reused as-is by the body.

### 2. Two hosts consume the same body

- **`app/(tabs)/village.tsx`** — wraps `<VillageHomeBody>` with `AppHeader`
  (`centerLabel={village.name}`), `municipalityId = profile.activeMunicipalityId`.
  Behaviour is unchanged from today; this is a pure refactor of the tab to consume
  the extracted hook/body.
- **`app/village/[villageId]/index.tsx`** — replaces today's thinner layout with
  `ScreenHeader` (back button, `title = village.name`) wrapping the **same**
  `<VillageHomeBody>`, `municipalityId = route param`. `ScreenHeader` is the back
  affordance (matches the barrio/place detail screens).

### 3. Join + admin parity in the pushed detail

The pushed detail is a *full* village home for whatever village you opened, not a
read-only preview:

- **Admin parity** — management affordances key off the *viewer's role for the
  viewed village* (`isAppAdmin || villageAdmin` for that municipality), exactly as
  the tab does. An organizer browsing their own village from discovery sees the
  same controls there as on the tab.
- **Self-join CTA** — lives **inside `<VillageHomeBody>`**, gated on `!isMember`.
  On the tab the viewer is always a member of their active village, so it never
  shows there; in the pushed detail a non-member sees a "this is your village"
  self-join CTA (the existing ungated self-join — `addVillageMember`, no approval).
  Tapping it joins, then `reload()` flips `isMember` and the CTA disappears.

### 4. Discovery rework (`VillageDiscovery`)

- **Search bar pinned at the top** (unchanged position).
- **Remove the "Cargar todos" footer button** (`discover.notSeeing`).
- **Two labelled groups** in one scroll:
  1. **"Municipios activos"** — `getActiveCommunities()`, client-side
     prefix-filtered by the search box (small list, already loaded).
  2. **"Todos"** — infinite-scroll, cursor-paginated over *all* municipalities by
     `nameLower`, driven by the new `listMunicipalitiesPage` service. Fetches the
     next page on `onEndReached`; the search box re-seeds this list server-side
     (debounced) using the same prefix query.
- **Awakened vs dormant** is visually distinguished per row: an active community
  shows an "Activo" accent badge; a dormant municipality shows a muted "Sin
  comunidad" treatment.
- **"Todos" overlaps "Municipios activos"** — active villages appear in both
  groups, badged. No dedupe (the active group is a curated shortcut; the full
  list is exhaustive).
- **Tap routing is unchanged**: active → `/village/[villageId]` (now the rich
  pushed detail); dormant → `/discover/start/[municipalityId]` (the start-village
  flow).

### 5. New service: `listMunicipalitiesPage`

```ts
listMunicipalitiesPage(opts: {
  search?: string;
  cursor?: QueryDocumentSnapshot | null;
  limit?: number; // default 20
}): Promise<{ items: (MunicipalityData & { id: string })[]; nextCursor: QueryDocumentSnapshot | null }>
```

- Orders by `nameLower` asc; applies the same prefix `where` clauses as
  `searchMunicipalities` when `search` is non-empty.
- Pages with `startAfter(cursor)`; `nextCursor` is the last snapshot of the page,
  or `null` when fewer than `limit` rows came back (list exhausted).
- `getActiveCommunities` is kept unchanged for the "Municipios activos" group.

## Rejected alternatives

- **Make the pushed detail a thin read-only preview** — rejected; the user wants
  the same horizontal-scroll format as the tab, and join must happen from there.
- **Promote discovery back to its own nav tab** — out of scope; it stays a pushed
  screen reached from profile/menu (per
  [village-discovery-onboarding](../../decisions/village-discovery-onboarding.md)).
- **Dedupe "Todos" against "Municipios activos"** — rejected; the overlap is
  intentional (shortcut + exhaustive list), and dedupe would complicate the cursor.
- **Offset/`limit`-based pagination** — Firestore has no offset; cursor
  (`startAfter` on `nameLower`) is the idiomatic and indexed approach.

## What this binds

- `<VillageHomeBody>` must stay free of data fetching and header chrome — both
  hosts depend on supplying their own header and on the body being purely
  presentational. New village-home features go in the body (shared by both
  surfaces) or in `useVillageHome` (shared data), not in a single host.
- The self-join CTA's visibility is `!isMember`, the single source of truth for
  "should this viewer be offered to join". Do not re-gate it per-host.
- `listMunicipalitiesPage` returns the raw `QueryDocumentSnapshot` cursor; callers
  treat it as an opaque token. The `nameLower` ordering + prefix clauses must match
  `searchMunicipalities` so the active-group filter and the full-list search agree.

## Revisit when

- A village home needs surfaces that differ between tab and pushed detail beyond
  the join CTA (then the body grows host-aware props, or splits).
- Discovery needs filters beyond name prefix (province, comunidad autónoma) — the
  cursor query would need composite indexes.
- The "Municipios activos" list grows large enough that loading it whole on mount
  is wasteful (then it, too, needs pagination).

## Testing

- `listMunicipalitiesPage` — vitest in `packages/shared`: first page, cursor
  follow-on, exhaustion (`nextCursor === null`), and search-prefixed paging.
- `useVillageHome` / `<VillageHomeBody>` — jest in `apps/mobile`: member vs
  non-member (join CTA visibility), admin vs villager (manage affordances),
  no-organizer wiki banner, dormant/active. Retarget the existing
  `village.test.tsx` at the refactored tab.
