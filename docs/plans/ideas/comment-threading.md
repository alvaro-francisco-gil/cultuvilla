# Comment Threading

## Goal

Let a user reply to a specific comment on an entity (event, news, place, barrio, organization, festival-poster), instead of every comment landing in one flat chronological list.

## Context

Comments today (`packages/shared/src/models/interaction/CommentDataModel.ts`,
`packages/shared/src/services/commentsService.ts`,
`apps/mobile/components/feature/EntityComments.tsx`) are flat: one top-level
`comments/` collection, scoped by `entityKind` + `entityId` + `municipalityId`,
ordered `createdAt asc`, rendered as a single Instagram-style list by the shared
`EntityComments` component used across all six entity detail screens. There is no
`parentCommentId` or reply concept anywhere in the schema, rules, or UI. See
`docs/decisions/entity-comments.md` for the original flat design's rationale
(generic top-level collection, one entityKind-routing Cloud Function trigger,
public-read/authenticated-create/owner-or-admin-delete rules).

This doc proposes adding one level of reply nesting on top of that existing
design, reusing as much of it as possible.

## Design / approach

### Scope decided during brainstorming

- **One level of nesting only.** A reply cannot itself be replied to (no
  reply-to-reply). Decided as a deliberate, permanent product stance — not a
  "v1 simplification."
- **Replies collapsed by default**, revealed via a per-comment "View N replies"
  toggle, lazy-loaded on tap.
- **Reply notifications**: the parent comment's author gets notified when
  someone replies (skipped when replying to your own comment).
- **Moderation is identical for comments and replies, forever** — no separate
  rules, no separate admin UI, no different permission model for replies vs.
  top-level comments. This was an explicit product decision, not a placeholder.

### Data shape: flat collection + `parentCommentId`, not a subcollection

Considered nesting replies under `comments/{commentId}/replies/{replyId}`
(the pattern AGENTS.md invariant #3 calls out for data "genuinely owned by a
parent doc," e.g. `events/{id}/registrations`). Rejected because:

- Every comment doc already carries `entityKind`/`entityId`/`municipalityId`
  directly — not for ownership reasons, but so a single flat query and the
  existing `syncEntityCommentCount` trigger never need a `get()` to learn which
  entity a comment belongs to. A subcollection reply loses that: the trigger
  would need an extra read on the parent comment doc (or duplicate those
  fields onto every reply anyway, undoing most of the benefit of nesting).
  Given "identically forever" moderation and "never reply-to-reply," a reply
  isn't a distinct object type with its own lifecycle — it's a comment with an
  extra pointer field, so it should live in the same collection with the same
  rules block and the same Cloud Function trigger.
- The usual reason to prefer a foreign key over a subcollection (avoiding
  fan-out reads when eagerly loading children) doesn't even apply here, since
  replies are lazy-loaded on tap, not eagerly fetched with the top-level list.

**Chosen:** replies are ordinary docs in the existing top-level `comments/`
collection, with `parentCommentId: string | null` (null for top-level
comments) and `replyCount: number` (denormalized onto the parent comment, 0
default, non-client-writable).

### Queries & indexing

Both the top-level list and a single comment's replies use the same filter
shape, so one composite index covers both:

```
entityKind == X, entityId == Y, parentCommentId == <null | commentId>, orderBy(createdAt asc)
```

This replaces the existing 3-field index
(`entityKind, entityId, createdAt` — `firestore.indexes.json:248-256`) with a
4-field one (`entityKind, entityId, parentCommentId, createdAt`).
`commentsService.getComments()` filters `parentCommentId == null`; a new
`getReplies(entityKind, entityId, parentCommentId)` filters
`parentCommentId == <commentId>`, called only when a comment's replies are
expanded.

### Rules (`firestore.rules`)

`isValidCommentCreate` gains an optional `parentCommentId`. When present, a
`get()` check on the referenced doc verifies it exists, shares the same
`entityKind` + `entityId`, and itself has `parentCommentId == null` — this is
what enforces one-level-only at the rules layer, not just in the UI. Read
stays public (`true`). Delete permissions (owner, village-admin, app-admin)
are unchanged and apply identically to replies.

### Cloud Functions (`functions/src/interaction/syncEntityInteractionCounts.ts`)

- On reply create/delete: increment/decrement the entity's `commentCount` (a
  reply is still a comment) **and** the parent comment's `replyCount`.
- On top-level comment delete: cascade-delete all docs with
  `parentCommentId == <deletedId>`, decrementing `commentCount` per reply
  deleted.
- On reply create: read the parent comment's `authorUserId` and write a
  notification to `users/{parentAuthorUserId}/notifications/`, skipped when
  `authorUserId == parentAuthorUserId` (self-reply).

### Mobile UI (`apps/mobile/components/feature/EntityComments.tsx`)

Top-level list is unchanged in shape (flat, oldest-first). Each top-level
comment gets a "Reply" action; if `replyCount > 0`, a "View N replies" toggle
lazy-loads and renders replies indented beneath it. Tapping "Reply" opens an
**inline composer directly under that comment** (not the bottom bar) that
posts with `parentCommentId` set. Replies do not get their own "Reply" action,
backstopping the one-level rule in the UI.

## Open questions

None outstanding — all scope questions were resolved during brainstorming (see
Design/approach above).
