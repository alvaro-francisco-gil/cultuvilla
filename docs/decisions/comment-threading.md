# Comment reply threading

## Context

Comments were flat (`docs/decisions/entity-comments.md`): one top-level
`comments/` collection, no reply concept. Product wanted one level of
reply nesting — reply to a specific comment, but not to a reply.

## Decision

- **Replies are ordinary docs in the same top-level `comments/` collection**,
  with `parentCommentId: string | null` (null for top-level) and a
  denormalized `replyCount` on the parent comment — not a
  `comments/{id}/replies/{id}` subcollection, even though a subcollection is
  the pattern this repo otherwise uses for data "genuinely owned by a parent
  doc" (see AGENTS.md invariant #3). Rejected the subcollection because every
  comment doc already carries `entityKind`/`entityId`/`municipalityId`
  directly so the existing `syncEntityCommentCount` trigger and rules never
  need a `get()` to learn which entity a comment belongs to; a subcollection
  reply would lose that (an extra read per write, or duplicated entity
  fields). Given replies are lazy-loaded (not eagerly fetched), the usual
  reason to prefer a foreign key over a subcollection — avoiding fan-out
  reads — didn't even apply here, so there was no offsetting benefit.
- **One level of nesting is enforced at three independent layers**, not just
  the UI: Firestore rules (`isValidReplyParent` requires the referenced
  parent to itself have `parentCommentId == null`, and — since a moderation
  bug surfaced this — that the reply's `municipalityId` matches the parent's,
  not just `entityKind`/`entityId`), the Cloud Function (cascade-delete only
  fires for `delta === -1 && !parentCommentId`, so a reply's own delete can
  never cascade), and the mobile UI (a reply row renders no "Responder"
  action).
- **`commentCount` accounting invariant:** every comment doc's own
  delete-trigger invocation unconditionally decrements the entity's
  `commentCount` by 1 — never conditioned on any other document's existence.
  An earlier version made a reply's decrement conditional on its parent
  comment still existing (to avoid double-counting during cascade delete);
  code review caught that this loses a decrement permanently if a direct
  reply delete's event is delivered after its parent happens to be deleted
  around the same time (Firestore event delivery isn't latency-bounded).
  The fix: cascade delete only *causes* the reply docs to be deleted (chunked
  at ≤500/batch) and does no `commentCount` math itself — production's real
  per-document trigger re-firing accounts for each cascaded reply
  independently, the same as any other delete.
- **Reply moderation is identical to top-level comment moderation, forever**
  — same delete rule (owner, village-admin of the comment's own
  `municipalityId`, or app-admin), no separate rules block, no separate admin
  UI. This is why the `municipalityId`-pinning rule above matters: without
  it, a reply could claim a different village than its parent and escape its
  real village's admins.

## What this binds

- A reply is a comment with an extra pointer field, not a new object type —
  don't give replies their own collection, rules block, or Cloud Function
  trigger later; extend the existing ones the way this feature did.
- Never make a document's own counter decrement conditional on another
  document's existence in a Firestore trigger — that's the specific shape of
  bug this feature already stepped on and fixed.
- If reply-to-reply nesting is ever requested, it needs new rules
  (`isValidReplyParent`'s `parent.data.parentCommentId == null` check is the
  single enforcement point) and a mobile UI change (replies would need their
  own "Responder" action) — this was a deliberate permanent product
  decision, not a v1 simplification, so treat a request to lift it as a new
  design discussion, not a quick toggle.

## Revisit-when

- A consumer needs the `comment_reply` notification to deep-link to the
  specific comment/thread, not just the entity — the notification currently
  carries `entityKind`/`entityId` only, no `commentId`.
- The narrow race where a reply is created in the same window its parent is
  deleted (rules see the parent alive, reply commits, but the cascade query
  already ran and misses it) produces a permanent orphan; a reconciliation
  sweep or `scripts/backfill-entity-comment-counts.mjs`-style follow-up would
  need to be run if this is ever observed in practice.
