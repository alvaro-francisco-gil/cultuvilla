---
status: draft
created: 2026-05-24
---

# News feed (noticias) — design spec

## Overview

A village-scoped social timeline ("noticias") where any villager can publish cultural content. Posts are moderated by the municipality admin (the "village organizer"), except for users marked as **trusted authors** for that municipality, whose posts auto-publish. Readers can leave reactions and comments; comments auto-publish but are reportable.

The feed is one common timeline ordered reverse-chronologically, with the reader's own village shown first and other villages below.

This is V1: in-app only (no push notifications), V1 reports cover comments only, and edits do not re-enter moderation.

## Goals

- Give villagers a place to publish cultural news, recaps, traditions, gastronomy notes, and similar.
- Keep moderation load low for the municipality admin by letting them grant a per-village "trusted author" bit to people they trust.
- Reuse the existing role model (`admin | user` on `/municipalities/{id}/members/{userId}`) and the existing first-class-collection architecture (AGENTS.md §3).

## Non-goals (V1)

- Push notifications. Discovery is in-app only.
- Posting as an organization without being a member of it.
- Cross-village federated posts. Each post belongs to exactly one municipality.
- Reporting posts. Only comments are reportable in V1.
- Edits requiring re-moderation. Authors can edit forever; admins can delete.
- Trust that follows a user across villages. Trust is per-municipality.

## Architecture decisions

- **Top-level collections, `municipalityId` field.** Matches AGENTS.md §3 / the 2026-04-29 open-feed migration. No nesting under `municipalities/`.
- **Trust lives on the membership doc**, not on the user. A user can be a trusted author for village A and not village B; trust is naturally revoked when the membership ends.
- **Cross-user writes (moderation, deletion, trust grants, report resolution) live in Cloud Function callables**, not the client service, per `guardrail-enforcement`.
- **Reactions and comments are top-level collections** referencing `postId`. Counts denormalized on the post via triggers, per `denormalized-read-model`.

## Data model

### `news/{postId}` (top-level)

```ts
{
  municipalityId: string;
  authorUserId: string;
  authorOrgId: string | null;   // optional: post "as" this org (must be a current member at submit time)
  title: string;
  body: string;                 // plain text or light markdown — TBD which during impl
  category: 'fiesta' | 'tradicion' | 'gastronomia' | 'historia' | 'otro';
  images: {                     // up to 10
    storagePath: string;
    width: number;
    height: number;
  }[];
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  submittedAt: Timestamp;
  publishedAt: Timestamp | null;
  createdBy: string;            // == authorUserId; kept for rules consistency
  updatedAt: Timestamp;
  reactionCounts: {             // denormalized, kept in sync by trigger
    like: number;
    heart: number;
  };
  commentCount: number;         // denormalized
}
```

### `newsComments/{commentId}` (top-level)

```ts
{
  postId: string;
  municipalityId: string;       // denormalized from the post (for rules + admin queue queries)
  authorUserId: string;         // always personal — no org voice on comments
  body: string;
  createdAt: Timestamp;
  hidden: boolean;              // flipped true by admin via report resolution
}
```

### `newsReactions/{reactionId}` (top-level)

`reactionId = ${postId}_${userId}` so each user can have at most one reaction per post; switching kind overwrites the same doc.

```ts
{
  postId: string;
  municipalityId: string;
  userId: string;
  kind: 'like' | 'heart';
  createdAt: Timestamp;
}
```

### `newsReports/{reportId}` (top-level)

```ts
{
  targetType: 'comment';        // V1: comments only
  targetId: string;             // commentId
  postId: string;
  municipalityId: string;
  reporterUserId: string;
  reason: string;
  createdAt: Timestamp;
  status: 'open' | 'dismissed' | 'actioned';
  resolvedBy: string | null;
  resolvedAt: Timestamp | null;
}
```

### Update to `VillageMemberData`

Add an optional field on `/municipalities/{municipalityId}/members/{userId}`:

```ts
trustedNewsAuthor?: boolean;    // defaults to false when absent
```

Only the municipality admin (or app admin) can set this — enforced via a Cloud Function callable, never written by the client.

## State machine and write paths

```
                  ┌─ trusted author     ──> approved (publishedAt = now)
client createPost ┤
                  └─ regular author     ──> pending ──> approved | rejected   (admin via callable)
                                                  │
                                                  └──> author edits freely (no re-moderation)
                                                       admin can hard-delete anytime (cascades)
```

| Action | Layer | Notes |
|---|---|---|
| Create post | client service `newsService.createNewsPost` | Rules enforce `status == 'pending'` unless the caller's member doc has `trustedNewsAuthor == true`. |
| Approve / reject post | callable `moderateNewsPost` | Sets `status`, `publishedAt`, `rejectionReason`. Rules deny client writes on these fields. |
| Edit own post | client service `newsService.updateNewsPost` | Owner only. Cannot touch `status`, `publishedAt`, `authorUserId`, `municipalityId`. |
| Delete post | callable `deleteNewsPost` | Admin only. Cascade-deletes `newsComments`, `newsReactions`, and any open `newsReports` for the post. |
| React to post | client service `newsService.reactToPost` | Doc id is deterministic; idempotent. Trigger updates `reactionCounts` on the post. |
| Remove reaction | client service `newsService.removeReaction` | Deletes the deterministic doc. Trigger decrements. |
| Add comment | client service `newsService.addComment` | Auto-publishes. Trigger increments `commentCount`. |
| Delete own comment | client service `newsService.deleteOwnComment` | Owner only. Trigger decrements. |
| Report comment | client service `newsService.reportComment` | Creates a `newsReports` doc. |
| Resolve report | callable `resolveNewsReport` | Admin only. On `action: 'remove'` flips `comment.hidden = true` and marks report `actioned`. On dismiss, marks report `dismissed`. |
| Toggle trusted author | callable `setTrustedNewsAuthor` | Admin only. Audited via `logger.info(...)` with `handler: 'setTrustedNewsAuthor'`. |

All callables enforce `isVillageAdmin(municipalityId)` server-side and log per `cloud-function-logging`.

## Feed queries

Two queries, merged client-side into a single feed with the home zone on top:

1. `news` where `municipalityId == homeMunId` and `status == 'approved'`, order by `publishedAt desc`, paginated.
2. `news` where `municipalityId != homeMunId` and `status == 'approved'`, order by `publishedAt desc`, paginated.

For the post detail view: one read for the post, paginated query for comments (`postId == X`, order by `createdAt asc`), client cache of whether the reader has a reaction (`get(newsReactions/${postId}_${uid})`).

## Firestore rules (summary)

- `news`
  - `read`: `isVillageMember(resource.data.municipalityId)`.
  - `create`: `isVillageMember(request.resource.data.municipalityId)` AND `request.resource.data.authorUserId == request.auth.uid` AND (`status == 'pending'` OR caller is a trusted member of that municipality). Also enforce `publishedAt == null` on `create` if `status == 'pending'`.
  - `update`: owner-only, AND none of `status`, `publishedAt`, `authorUserId`, `municipalityId`, `submittedAt`, `createdBy`, `reactionCounts`, `commentCount` are in `affectedKeys()`. (Counts are written by triggers via admin SDK and bypass rules.)
  - `delete`: `false` — only the `deleteNewsPost` callable.
- `newsComments`
  - `read`: `isVillageMember(resource.data.municipalityId)`.
  - `create`: `isVillageMember(request.resource.data.municipalityId)` AND `authorUserId == auth.uid` AND `hidden == false`.
  - `update`: `false` — comments are not editable in V1 (clients flip `hidden` via the callable only).
  - `delete`: owner-only.
- `newsReactions`
  - `read`: village member.
  - `create`/`update`: deterministic id matches `${postId}_${auth.uid}`, plus `userId == auth.uid`.
  - `delete`: owner only.
- `newsReports`
  - `read`: `isVillageAdmin(resource.data.municipalityId)` OR own report.
  - `create`: any village member, with `reporterUserId == auth.uid` and `status == 'open'`.
  - `update`/`delete`: `false` — admin updates go through `resolveNewsReport`.
- `municipalities/{id}/members/{uid}`: extend the existing rule so the client cannot write `trustedNewsAuthor` directly — only via `setTrustedNewsAuthor`.

## Indexes (firestore.indexes.json)

- `news`: `(municipalityId asc, status asc, publishedAt desc)` — home-village feed.
- `news`: `(status asc, publishedAt desc)` — other-villages feed.
- `newsComments`: `(postId asc, createdAt asc)` — thread display.
- `newsReports`: `(municipalityId asc, status asc, createdAt desc)` — admin queue.

## Storage

Post images uploaded to Firebase Storage under `news/{postId}/images/{imageId}.{ext}`. Storage rules: only the author can write; any village member of the post's municipality can read.

## i18n

New `news` namespace in `packages/i18n/`. Spanish first; structure follows the `i18n-add-string` skill. Web consumes via `next-intl`; mobile via the `useT()` adapter.

## Testing

- **Service vitest** — `packages/shared/test/services/newsService.test.ts`. Shape of writes, idempotent reactions, no client writes to admin-only fields.
- **Cloud Function vitest emulator** — `functions/test/news/`. Tests for `moderateNewsPost`, `deleteNewsPost` (cascade), `resolveNewsReport`, `setTrustedNewsAuthor`. Trigger tests for `reactionCounts` and `commentCount` denorm sync against a known sequence of reaction/comment events.
- **Rules e2e** — `packages/shared/test/e2e/newsRules.test.ts`. Trusted member can create `approved`; non-trusted member can only create `pending`; non-member cannot create; nobody but admin can flip `status` or `publishedAt`; deleting posts via client is denied; report queue is admin-only.

## UI surfaces

Mobile-first (the immediate target is `apps/mobile/`). Surfaces:
- **Feed tab** — combined home-village + other-villages list with a section header between zones.
- **Post detail** — title, body, gallery, reactions, comments thread.
- **Composer** — title, body, category picker, image picker (up to 10), optional org selector (only shown when the user is a member of at least one org in that municipality).
- **Moderation queue** — admin-only screen with the pending posts and the reports queue.
- **Member admin** — toggle `trustedNewsAuthor` on a member.

Web surfaces (`apps/web/`) mirror these where applicable.

## Risks and open questions

- **Body format** — plain text vs. light markdown. Plain text is enough for V1; markdown can be added later without a model change.
- **Image moderation** — V1 trusts the moderator's review for non-trusted authors. Trusted authors post without image review. Acceptable for the current scale; reportable posts could be a V2 lever.
- **Counter drift** — `reactionCounts` / `commentCount` denormalization can drift on partial failures. Mitigation: periodic reconciliation job, deferred.
- **`!=` query for the "other villages" zone** — Firestore's inequality has limitations; if it proves too restrictive, fall back to a single `(status, publishedAt)` query and partition client-side.
