# Entity comments, reactions & counts

## Goal

Let anyone browsing the app read and post comments (and like/heart reactions) on every village entity — event, festival-poster (cartel), place, barrio, organization, news — with comment/reaction counts denormalized onto each entity.

## Context

Comments were requested so residents and visitors can express thoughts on the things a
village publishes. Investigation found a **complete comments + reactions + reports backend
already exists, but only for `news`** (`newsComments` / `newsReactions` / `newsReports`,
`newsService`, matching rules, index, and a `commentCount` trigger). It is **never wired
into any UI** — not even for news — and its read rules gate to village members, which is
*more* restrictive than the entities it attaches to. All six entity docs are already
publicly readable (`allow read: if true` on `events`, `organizations`, `municipalities`,
`persons`, approved `news`), part of the open-feed architecture
([docs/decisions/open-feed-architecture.md](../../decisions/open-feed-architecture.md)).

So this work is mostly **generalizing a known-good, tested pattern to all six entities** —
fan-out, not invention — plus building the first comment UI (greenfield) and fixing the
visibility inconsistency. The news-specific backend is deleted and replaced by the generic
system (delete > deprecate; the user confirmed no real comment data exists to migrate).

## Design / approach

### Entity kind

Reuse the existing `EntityKind` union from
[apps/mobile/lib/entities/registry.ts](../../../apps/mobile/lib/entities/registry.ts):
`'event' | 'festivalPoster' | 'place' | 'barrio' | 'organization' | 'news'`. Promote it (or
a shared copy) into `@cultuvilla/shared` so models/services can reference it, since comments
live in the shared package.

### Data model — two generic top-level collections

Per architecture invariant #3 (first-class top-level collections scoped by `municipalityId`),
comments are **not** sub-collections. Replace `newsComments` / `newsReactions` /
`newsReports` with:

```
comments   { entityKind, entityId, municipalityId, authorUserId, body, createdAt }
reactions  { entityKind, entityId, municipalityId, userId, kind }   // doc id: `${entityKind}_${entityId}_${userId}`
```

- Flat comments — **no reply threads** (out of scope; a separate future feature).
- No `hidden` flag and no `reports` collection — moderation is a hard delete gated by rules
  (see below), so soft-hide/reporting infrastructure is unnecessary for the MVP.
- Reaction `kind` ∈ `'like' | 'heart'` (carried from the news model). One reaction per user
  per entity, enforced by the deterministic doc id `${entityKind}_${entityId}_${userId}`.
- Every comment/reaction carries `municipalityId` so the village-admin delete rule can scope
  by village without an extra read.

### Counts — denormalized onto each entity

Each of the six entity docs gains `commentCount` and `reactionCount` (`number`, default 0).
A Cloud Function trigger on `comments` / `reactions` increments/decrements the parent doc,
routing by `entityKind` → parent collection. This follows the established
[denormalized read-model pattern](../../architecture/denormalized-read-models.md); news
already has `commentCount`, so this generalizes that trigger. Powers the "💬 3" / total-
reactions badges on cards and in the detail header.

`reactionCount` is the **total** across kinds — enough for the card/header badge. The
**per-kind** breakdown the detail reaction bar shows (N likes, M hearts) is *not*
denormalized; the detail screen reads it via `commentsService.getReactionCounts(kind,
entityId)`. This keeps the entity docs to two scalar fields and avoids a per-kind field
explosion.

Because five entities gain two new required model fields, **backfill the dev docs**
(`villa-events`) in the same change so the strict Zod converters don't throw on existing
docs (per AGENTS.md "Backfill dev when a schema field is added"). One idempotent
`scripts/backfill-entity-comment-counts.mjs`, verified with `pnpm check:dev-conformance`.

### Rules & permissions

- **Read comments & reactions: everyone** — `allow read: if true`, matching entity
  visibility. (Fixes the old village-member gate.)
- **Create: any authenticated user** — `isAuthenticated()`, `authorUserId`/`userId` must
  equal `request.auth.uid`, plus a shape validator (`isValidCommentCreate` /
  `isValidReactionCreate`) mirroring the model. No village-membership requirement, so a
  passing-through visitor can post.
- **Update:** comments `if false` (immutable). Reactions are delete-then-create, not updated.
- **Delete (hard delete via rules — no callable):**
  - Comment owner: `isOwner(resource.data.authorUserId)`.
  - Village admin of the comment's village: `isVillageAdmin(resource.data.municipalityId)`.
  - App admin anywhere: `isAppAdmin()`.
  - Reaction: owner only (`isOwner(resource.data.userId)`).

This mirrors the org-reject precedent (moderation as a rules-gated client write), so no
moderation Cloud Function is needed.

### Service — one `commentsService`

New `packages/shared/src/services/commentsService.ts`:
`addComment`, `deleteComment`, `getComments(kind, entityId)`, `reactToEntity`,
`removeReaction`, `getMyReaction(kind, entityId)`, `getReactionCounts`. Delete the
comment/reaction functions from
[packages/shared/src/services/newsService.ts](../../../packages/shared/src/services/newsService.ts)
and the news-specific models/converters/refs.

### Mobile UI — one shared component

`<EntityComments kind entityId municipalityId />`, built from primitives, dropped into the
`{children}` of all six
[EntityDetailScaffold](../../../apps/mobile/components/feature/EntityDetailScaffold.tsx)
consumers. Renders: a reaction bar (like/heart with counts), the comment list (author +
relative time via `formatRelativeTime` + body + delete affordance for owner/admin), and a
compose input for signed-in users (a sign-in prompt otherwise). Cards
(`EntityCard`/`BigCard`) get a small comment-count badge. Respect `insets.bottom` for the
compose input if it anchors to the bottom.

### Testing

- Vitest service tests for `commentsService` (in `packages/shared/test/`).
- `@firebase/rules-unit-testing` e2e rules test (template:
  `packages/shared/test/e2e/newsRules.test.ts`) covering: public read, auth-required create,
  self-only authorship, owner/village-admin/app-admin delete matrix.
- Count-trigger test under `functions/`.
- One new composite index: `comments (entityKind, entityId, createdAt)` in
  [firestore.indexes.json](../../../firestore.indexes.json). (No `hidden` field means no
  `hidden` in the index.)

## Out of scope (rejected / deferred)

- **Reply threads / nested comments** — flat only for now.
- **Soft-hide (`hidden` flag) & user-reporting (`reports` collection)** — replaced by hard
  delete gated by rules; revisit if abuse becomes a problem.
- **Owner/author notification on new comment** — the trigger pattern exists
  (`users/{uid}/notifications`) but is deferred; not in this iteration.
- **Data migration of existing news comments** — confirmed none exist; the old collections
  and code are deleted, not migrated.
