# Remove reactions, add invisible read count, feed/poster tweaks

## Problem

The recently-added comments feature ships two entity reactions (thumbs-up `like`
and `heart`). Product only wants comments — reactions add UI noise and backend
surface with no clear value. Separately, we want a lightweight, **invisible**
read-count metric per entity for future analysis, the feed card's comment count
should sit on the title line, the festival-poster detail must always show
comments last, and the "be the first to comment" empty-state string should go.

## Goals

1. Remove the reactions feature completely (delete > deprecate — no shims, no dead code).
2. Add a denormalized, function-owned `readCount` on entities, incremented on every
   detail-screen open, **never rendered**.
3. Feed card: move `commentCount` from the bottom-scrim meta row onto the title row,
   right-aligned.
4. Festival-poster detail: comments section always renders last, after all images.
5. Remove the `comments.empty` string; empty comment lists render nothing.

## Non-goals

- Displaying the read count anywhere (deliberately invisible for now).
- Unique-per-user read counting — `readCount` counts every detail-screen open.
- Any migration of beta/prod data (dev-only backfill; prod handled at release per AGENTS.md).

## Affected entities

Reactions/counts live on six entity kinds: `event`, `festivalPoster`, `news`,
`organization`, and `place` + `barrio` (the latter two as schemas inside
`MunicipalityDataModel`).

## Design

### 1. Remove reactions

- **Delete files:** `apps/mobile/components/feature/ReactionBar.tsx` (+ `ReactionBar.test.tsx`),
  `packages/shared/src/firebase/converters/reactionConverter.client.ts` + `.admin.ts`,
  `packages/shared/src/models/interaction/ReactionDataModel.ts` (and its re-export in
  `models/interaction/index.ts`).
- **Refs:** remove `reactionsCollection` / `reactionDoc` from `firebase/refs/client.ts`
  and `firebase/refs/admin.ts` (and the converter imports).
- **Service:** remove `reactToEntity`, `removeReaction`, `getMyReaction`,
  `ReactToEntityInput` from `commentsService.ts`.
- **Models:** drop `reactionCounts` field + `ReactionCountsSchema`/`NewsReactionCountsSchema`
  usage + the `{ like:0, heart:0 }` builder defaults from all six entity models.
- **UI:** `EntityComments.tsx` — remove the `ReactionBar` render and the
  `initialReactionCounts` prop; remove `initialReactionCounts={…reactionCounts}` from
  all six detail screens.
- **Function:** delete `syncEntityReactionCounts` from
  `functions/src/interaction/syncEntityInteractionCounts.ts` and its export in
  `functions/src/index.ts` (keep `syncEntityCommentCount`).
- **Rules:** remove `reactionCounts` from every entity create/update validation block,
  the `isValidReactionCounts` helper, and the whole `/reactions/{reactionId}` match block.
- **i18n:** remove `comments.reactionLike` and `comments.reactionHeart`.
- **Tests:** update reaction assertions in the rules/model/service/function test suites;
  remove reaction-only tests and the reaction portions of `entity-comments.spec.ts`,
  `commentsService.test.ts`, `commentsServiceIntegration.test.ts`, `interaction.test.ts`,
  `interactionRules.test.ts`, `syncEntityInteractionCounts.test.ts`.

### 2. Invisible `readCount`

- Add `readCount: z.number().int()` (builder default `0`) to the six entity models,
  mirroring `commentCount`.
- New Cloud Function callable `recordEntityView({ entityKind, entityId, municipalityId })`
  that does `FieldValue.increment(1)` on the parent doc via admin SDK, reusing the
  `applyToParent` routing already in `syncEntityInteractionCounts.ts` (extract/share it).
  No auth required (guests browse). Best-effort: swallow not-found (parent deleted).
- Client service wrapper `recordEntityView(...)` in `commentsService.ts` (or a small new
  service) calling the callable; detail screens fire it once on mount, fire-and-forget.
- **Rules:** `readCount` created as `0` and function-owned (client-immutable), same
  treatment `commentCount` receives in every entity block.
- **Docs:** add `readCount` to `packages/shared/src/services/_services-map.md` and
  `docs/architecture/denormalized-read-models.md`.
- **Not rendered** in any screen or card.

### 3. FeedCard

Move the `commentCount` block out of the location/date row and into the title row:
title `Text` becomes `flex:1` with `numberOfLines={1}`, comment count (chat icon +
number) pinned to the right on the same baseline, shown only when `> 0`. Keep the
`feed-card-comment-count` testID.

### 4. Festival-poster detail ordering

In `apps/mobile/app/village/[villageId]/festival-poster/[posterId].tsx`, move the
extra-images block (`images.slice(1)`) out of `belowContent` into `children`, rendered
before `<EntityComments>`, so on-screen order is: hero → title → subtitle → extra
images → comments. `belowContent` becomes unused here.

### 5. Empty-state string

Remove `comments.empty`. In `EntityComments.tsx`, when `comments.length === 0` and not
loading, render nothing (just the input/sign-in affordance below).

## Dev data

- One-off idempotent `scripts/backfill-entity-readcount.mjs`: for each of the six
  collections, patch docs missing `readCount` to `0` and strip the now-removed
  `reactionCounts` field (`FieldValue.delete()`). Project-id guard (`villa-events`).
  (Zod strips unknown keys, so leftover `reactionCounts` won't crash reads, but we
  remove it to match delete>deprecate.)
- Verify with `pnpm check:dev-conformance` before and after.

## Testing

- Model builder tests: assert `readCount` defaults to 0, no `reactionCounts`.
- Service test: `recordEntityView` calls the callable with the right args.
- Function test: `recordEntityView` increments the parent `readCount`; not-found no-ops.
- Rules tests (`interactionRules`, per-entity rules): `readCount` is client-immutable,
  create requires `readCount == 0`; `/reactions` writes are gone.
- Component test: `EntityComments` renders no reaction bar and no empty string.
- FeedCard: comment count appears on the title row when `> 0`.
- Full `pnpm check` gate.

## Risks

- Rules edits touch every entity block — easy to miss one; rules tests are the guard.
- `recordEntityView` writes on every detail open (cost) — acceptable at current scale;
  revisit if it becomes hot.
