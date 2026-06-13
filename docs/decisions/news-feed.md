# News feed: top-level collections, trusted-author moderation bypass, denormalized counters

## Context

Villagers needed a place to publish cultural news ("noticias") scoped to a
municipality. Posts are moderated by the village admin to keep quality up, but
forcing every post through a queue would overload admins. The feed reuses the
existing `admin | user` membership model and the first-class top-level
collection architecture (AGENTS.md §3, see [open-feed-architecture](open-feed-architecture.md)).

## Decision

- Four **top-level** collections scoped by a `municipalityId` field — `news/`,
  `newsComments/`, `newsReactions/`, `newsReports/` — not nested under
  `municipalities/`. Matches the open-feed migration.
- **Trusted-author bypass:** an optional `trustedNewsAuthor` boolean on the
  membership doc (`municipalities/{id}/members/{uid}`) lets a member create
  posts directly as `approved`; everyone else creates `pending` and waits for
  admin review. Trust is per-municipality and dies with the membership.
- **Reaction/comment counters are denormalized onto the post**
  (`reactionCounts.{like,heart}`, `commentCount`) and kept in sync by Cloud
  Function triggers on `newsReactions`/`newsComments` using
  `FieldValue.increment(±1)`. Same pattern as [open-feed-architecture](open-feed-architecture.md)'s
  denormalized read model.
- **Cross-user writes live in callables, never the client:** `moderateNewsPost`,
  `deleteNewsPost` (cascade), `resolveNewsReport`, `setTrustedNewsAuthor`. Each
  enforces village-admin (or app-admin) server-side. Rules deny client writes to
  `status`, `publishedAt`, the counters, and `trustedNewsAuthor`.
- V1: reports cover **comments only**; comments auto-publish and are hidden
  (not deleted) on report resolution; edits never re-enter moderation.

## Rejected alternatives

- **Nesting under `municipalities/{id}/`** — rejected for the same reasons as
  the open feed: cross-village queries and uniform rules are easier on top-level
  collections.
- **Trust as a user-level flag** — rejected; trust must not follow a user across
  villages, and must revoke naturally when they leave.
- **Live `count()` queries instead of denormalized counters** — rejected for
  read cost on a timeline; the trigger keeps counts on the post.

## What this binds

- The increment-based counters are **not clamped** — they can drift on partial
  trigger failure. A reconciliation job is deferred; do not assume counts are
  exact.
- `trustedNewsAuthor` is writable **only** via `setTrustedNewsAuthor` — even
  admins cannot set it through a direct member-doc write (rules forbid it).
- Any new privileged news mutation belongs in a callable, not `newsService`.
- A reaction doc id is deterministic: `${postId}_${userId}` (one reaction per
  user per post).

## Revisit when

- Posts (not just comments) need to be reportable.
- Counter drift is observed in practice → add the reconciliation job.
- Push notifications or markdown bodies are wanted (both deferred from V1).
