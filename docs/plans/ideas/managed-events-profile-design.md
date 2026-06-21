# Profile screen: "Eventos gestionados" section

**Date:** 2026-06-21
**Status:** Approved (design)

## Goal

Add an "Eventos gestionados" (managed events) section to the user profile: a
horizontal scroll of every event the person created, with an "En curso"
(ongoing) badge on events happening right now — the ordago "live" look.

## Current state

- `apps/mobile/app/(tabs)/profile.tsx` already calls `getEventCountByCreator(uid)`
  for the stats row, but renders no event list.
- `packages/shared/src/services/eventService.ts` exposes
  `getEventsByCreator(userId)` → `(EventData & { id })[]`, `where('createdBy','==',uid)`
  ordered by `createdAt` desc. A composite index `(createdBy, createdAt)` exists.
- `packages/shared/src/models/event/EventDataModel.ts` defines `EventData`:
  `startDate: Date`, `endDate: Date | null`, `status: 'draft'|'published'|'cancelled'|'completed'`,
  `createdBy`, `imageURL`, `municipalityCoverImage`, `organizationName`, etc.
  There is no stored "ongoing" status; it is derived from dates + status.
- `apps/mobile/components/feature/EventCard.tsx` (over `FeedCard.tsx`) is the
  app-wide event card: 4:3 cover image + scrim, title, `organizationName` |
  `formatDate(startDate,'short')`. Neither supports a badge today.
- `VillagesScroll` / `PersonaScroll` (`components/feature/profile/`) are the
  horizontal-scroll pattern to mirror.

## Design

### 1. `isEventOngoing` helper (source of truth for "en curso")

Add to `packages/shared/src/models/event/EventDataModel.ts`:

```ts
export function isEventOngoing(
  event: Pick<EventData, 'status' | 'startDate' | 'endDate'>,
  now: Date,
): boolean {
  if (event.status !== 'published') return false;
  if (event.startDate > now) return false;
  if (event.endDate !== null && event.endDate < now) return false;
  return true;
}
```

Unit-tested in `packages/shared` (vitest): before start, during (with end),
during (null end), after end, non-published.

### 2. Badge support on the event card

Add an optional `badge?: string | null` prop to `FeedCard`. When present, render
a small ACCENT-colored pill overlaid at the top-left of the cover-image area
(absolute-positioned inside the existing image container). Thread the prop
through `EventCard` (extend `EventCardProps` with `badge?: string | null`,
default undefined). No behavior change for existing call sites.

### 3. New component — `ManagedEventsScroll`

`apps/mobile/components/feature/profile/ManagedEventsScroll.tsx`:

```ts
interface ManagedEventsScrollProps {
  events: (EventData & { id: string })[];
  now: Date;
  ongoingLabel: string;
  emptyLabel: string;
  onPressEvent: (id: string) => void;
}
```

Behavior:
- Partition `events` with `isEventOngoing(e, now)` into `ongoing` and `rest`,
  preserving input order within each group; sort `ongoing` by `startDate` asc.
  Render order: ongoing first, then rest (rest keeps the service's createdAt-desc
  order).
- Render a horizontal `FlatList` of `EventCard`, `keyExtractor` = event id,
  `contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}`. Ongoing cards get
  `badge={ongoingLabel}`; others get no badge.
- Empty (`events.length === 0`): a muted `emptyLabel` `Text` in a `px-4` view
  (no add-card — events are created elsewhere).
- `onPress` per card → `onPressEvent(id)`.

`EventCard` consumes `EventLike`, which already carries `id`, `title`,
`startDate`, `organizationName`, `imageURL`, `municipalityCoverImage` — all
present on `EventData`, so passing the event through is type-compatible.

### 4. Profile wiring (`profile.tsx`)

- Import `getEventsByCreator`, `isEventOngoing` (model), `ManagedEventsScroll`,
  and the `EventData` type.
- Add state `managedEvents: (EventData & { id })[]`.
- In `load()`, fetch the list. The existing count call can be replaced by
  deriving the list once: call `getEventsByCreator(uid)` (wrapped in
  `withFirestoreErrorLog`), set `managedEvents`, and set `eventsCreated` to
  `list.length` — removing the now-redundant `getEventCountByCreator` call.
- Add a `ProfileSectionHeader title={t('profile.managedEventsSection.title')}` +
  `<ManagedEventsScroll … now={new Date()} … onPressEvent={(id) => router.push(\`/event/${id}\`)} />`,
  placed right after the Personas section block.

### 5. i18n

New keys under `profile.managedEventsSection`:
- `title` = "Eventos gestionados"
- `empty` = "Aún no gestionas ningún evento"
- `ongoing` = "En curso"

### 6. Tests

- vitest (`packages/shared`): `isEventOngoing` cases above.
- jest (mobile): `ManagedEventsScroll` — renders a card per event; an ongoing
  event shows the "En curso" badge and is hoisted before a non-ongoing one;
  empty state shows the empty label; pressing a card calls `onPressEvent` with
  the id.
- jest (mobile): update `profile.test.tsx` — mock `getEventsByCreator` and
  `ManagedEventsScroll`; assert `getEventsByCreator` is called with the uid.

## Decisions / out of scope

- Tapping any managed event → `/event/{id}` (drafts are being removed in a
  parallel effort, so no draft-specific handling).
- Only ongoing events get a badge. Draft/cancelled/completed render as plain
  event cards. No distinct status badges for those.
- "Managed" = `createdBy == uid` (what `getEventsByCreator` returns). No change
  to the query or its index.
