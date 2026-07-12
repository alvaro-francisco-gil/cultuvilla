# Entity reactions removed; invisible read count added

**Status:** Shipped (branch `feat/remove-reactions-read-count`).

## Context

The comments feature shipped with two entity reactions (`like` = thumbs-up,
`heart`), rendered as a `ReactionBar` inside `EntityComments`, backed by a
top-level `reactions/` collection, per-user reaction docs, a
`syncEntityReactionCounts` trigger, and a denormalized `reactionCounts.{like,heart}`
on six entity kinds. Product decided reactions add UI noise without clear value.

## Decision

1. **Reactions removed entirely** across every layer — models, converters, refs,
   `commentsService` functions, the Cloud Function trigger, Firestore rules, the
   `reactions/` collection, mobile UI (`ReactionBar` deleted), i18n, tests, and
   scripts. No shims, no dead code (repo rule: delete > deprecate).

2. **Invisible `readCount` replaces it** on the same six entity kinds (`event`,
   `festivalPoster`, `news`, `organization`, `place`, `barrio`) as a denormalized,
   **function-owned** counter (`z.number().int()`, default `0`), mirroring how
   `commentCount` is treated:
   - Written **only** by a no-auth callable `recordEntityView({ entityKind,
     entityId, municipalityId })` that does `FieldValue.increment(1)` on the parent
     via the shared `applyToParent` router (`functions/src/interaction/`). The field
     name and increment value are hardcoded in the callable — no user input reaches
     them, so it cannot be turned into an arbitrary write; worst case is spammed
     increments on a valid entity, which is harmless because the value is never shown.
   - Firestore rules forbid client writes to `readCount` and require `readCount == 0`
     on create, in all six entity blocks.
   - Fired **fire-and-forget once per detail-screen mount** (`useEffect` keyed on
     `entity?.id`, so re-renders/refocus don't re-fire and inflate the count).
   - **Never displayed** — it exists purely for future analysis.

## Rationale for the callable (not a client increment)

Denormalized counts in this codebase are function-owned by convention (clients
never write `commentCount`/`reactionCounts` directly; triggers do). A client-side
`increment` on the entity doc would require per-collection increment-only rule
carve-outs and is trivially abusable. A single no-auth callable keeps `readCount`
function-owned, consistent with the rest of the counter infrastructure.

## Consequential UI changes shipped alongside

- **FeedCard:** comment count moved from the bottom-scrim meta row onto the title
  row (right-aligned); title takes the slack and ellipsises.
- **Festival-poster detail:** comments always render last, after all poster images
  (extra images moved from the scaffold's `belowContent` slot into `children` before
  `EntityComments`; the now-unused `belowContent` prop was removed from the scaffold).
- **Empty comment state:** the "Sé el primero en comentar" string was removed; an
  empty list renders nothing.

## Migration / ops notes

- Dev (`villa-events`) backfilled idempotently by
  `scripts/backfill-entity-readcount.mjs` (sets `readCount: 0` where missing, deletes
  stale `reactionCounts`). Beta/prod: the read schema strips unknown keys, so stale
  `reactionCounts` won't crash reads; run the same backfill at release if desired.
- **Deploy:** `recordEntityView` is a new no-auth v2 callable — grant
  `allUsers → run.invoker` on its Cloud Run service, or unauthenticated web calls
  return `internal`. It carries `cors: true`, matching every other callable, so the
  web-first build can invoke it cross-origin.
