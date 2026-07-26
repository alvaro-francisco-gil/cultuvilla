# Comment Threading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user reply to a specific comment on an entity, instead of every comment landing in one flat chronological list.

**Architecture:** Replies are ordinary docs in the existing top-level `comments/` collection with a new `parentCommentId` field (null for top-level comments), not a subcollection — reusing the existing rules block, Cloud Function trigger, and query pattern. One level of nesting only; replies are lazy-loaded per comment via a "View N replies" toggle.

**Tech Stack:** Firestore (rules + composite indexes), Cloud Functions v2 (`onDocumentWritten` trigger), `packages/shared` (zod models, vitest), Expo/React Native mobile UI (NativeWind).

## Global Constraints

- One level of nesting only — replies cannot themselves be replied to; enforced in Firestore rules (Task 4), not just the UI.
- Moderation (delete permissions) must remain identical between top-level comments and replies — no separate rules or admin path.
- Any new required model field must be backfilled against dev (`villa-events`) in the same change, per this repo's "Backfill dev when a schema field is added" rule — see Tasks 2 and 6.
- Work happens in a worktree + feature branch (`.claude/worktrees/comment-threading/`), branched from latest `develop`; PR targets `develop`.

---

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

`isValidCommentCreate` gains two always-present fields (mirroring the existing
`readCount == 0` function-owned-counter pattern used for entities):
`parentCommentId` (string or `null` — required on every create, not
omittable) and `replyCount` (must equal `0` on create; clients can never
create a reply with a nonzero seed count). When `parentCommentId` is not
`null`, a `get()` check on the referenced doc verifies it exists, shares the
same `entityKind` + `entityId`, and itself has `parentCommentId == null` —
this is what enforces one-level-only at the rules layer, not just in the UI.
Read stays public (`true`). `allow update: if false` already covers
`replyCount`/`commentCount` being function-owned (Cloud Functions write via
the admin SDK, which bypasses rules entirely). Delete permissions (owner,
village-admin, app-admin) are unchanged and apply identically to replies.

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

## File Structure

- Modify: `packages/shared/src/models/interaction/CommentDataModel.ts` — add `parentCommentId`, `replyCount`
- Modify: `packages/shared/src/services/commentsService.ts` — filter top-level, add `getReplies`, `addComment` accepts `parentCommentId`
- Modify: `packages/shared/src/models/notification/NotificationDataModel.ts` — add `comment_reply` type + `entityKind`/`entityId` nullable fields
- Modify: `firestore.rules` — `isValidCommentCreate` gains `parentCommentId`/`replyCount` + one-level-only `get()` check
- Modify: `firestore.indexes.json` — replace 3-field comments index with the 4-field one
- Modify: `functions/src/interaction/syncEntityInteractionCounts.ts` — `replyCount` sync, cascade delete, reply notification
- Modify: `packages/i18n/messages/es.json` — reply/view-replies/replying-to strings
- Modify: `apps/mobile/components/feature/EntityComments.tsx` — reply action, inline composer, view-replies toggle
- New: `scripts/backfill-comment-threading.mjs` — backfill dev docs missing the new fields
- Modify: `packages/shared/src/services/_services-map.md`, `docs/architecture/denormalized-read-models.md`, `CHANGELOG.md` — doc sync
- Test: `packages/shared/test/models/CommentDataModel.test.ts` (new or extended), `packages/shared/test/services/commentsService.test.ts`, `packages/shared/test/e2e/interactionRules.test.ts`, `packages/shared/test/models/NotificationDataModel.test.ts` (new or extended), `functions/src/__tests__/handlers/interaction/syncEntityInteractionCounts.test.ts`

## Tasks

### Task 1: Model — `parentCommentId` + `replyCount` on `CommentDataModel`

**Files:**
- Modify: `packages/shared/src/models/interaction/CommentDataModel.ts`
- Test: `packages/shared/test/services/commentsService.test.ts` (schema is exercised indirectly through the service in this codebase's existing test layout — no separate model test file exists for comments today, so extend the service test's `addComment` assertions instead of creating a new file)

**Interfaces:**
- Produces: `CommentData` now includes `parentCommentId: string | null` and `replyCount: number`. `CommentDataInput` gains `parentCommentId?: string | null` (defaults to `null`) — `replyCount` is NOT part of `CommentDataInput`; `buildCommentData` always sets it to `0` (function-owned, never client-supplied).

- [ ] **Step 1: Write the failing test**

Add to `packages/shared/test/services/commentsService.test.ts`, inside the `commentsService — comments` describe block:

```ts
  it('addComment defaults parentCommentId to null and replyCount to 0', async () => {
    const id = await addComment({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'X',
    });
    const snap = fakeStore()[`comments/${id}`];
    expect(snap['parentCommentId']).toBeNull();
    expect(snap['replyCount']).toBe(0);
  });

  it('addComment accepts an explicit parentCommentId for a reply', async () => {
    const parentId = await addComment({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'Parent',
    });
    const replyId = await addComment({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u2', body: 'Reply',
      parentCommentId: parentId,
    });
    expect(fakeStore()[`comments/${replyId}`]['parentCommentId']).toBe(parentId);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/services/commentsService.test.ts`
Expected: FAIL — `parentCommentId`/`AddCommentInput.parentCommentId` don't exist yet.

- [ ] **Step 3: Implement the model change**

`packages/shared/src/models/interaction/CommentDataModel.ts`:

```ts
import { z } from 'zod';
import { EntityKindSchema } from './EntityKind';

export const CommentDataSchema = z.object({
  entityKind: EntityKindSchema,
  entityId: z.string(),
  municipalityId: z.string(),
  authorUserId: z.string(),
  body: z.string().min(1).max(2000),
  createdAt: z.date(),
  parentCommentId: z.string().nullable(),
  replyCount: z.number().int().min(0),
});
export type CommentData = z.infer<typeof CommentDataSchema>;

export interface CommentDataInput {
  entityKind: z.infer<typeof EntityKindSchema>;
  entityId: string;
  municipalityId: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
  parentCommentId?: string | null;
}

export function buildCommentData(input: CommentDataInput): CommentData {
  return {
    entityKind: input.entityKind,
    entityId: input.entityId,
    municipalityId: input.municipalityId,
    authorUserId: input.authorUserId,
    body: input.body,
    createdAt: input.createdAt,
    parentCommentId: input.parentCommentId ?? null,
    replyCount: 0,
  };
}
```

- [ ] **Step 4: Update `AddCommentInput` and `addComment` in `commentsService.ts`**

`packages/shared/src/services/commentsService.ts` — add `parentCommentId?: string | null` to `AddCommentInput` and pass it through in `addComment`:

```ts
export interface AddCommentInput {
  entityKind: EntityKind;
  entityId: string;
  municipalityId: string;
  authorUserId: string;
  body: string;
  parentCommentId?: string | null;
}

export async function addComment(input: AddCommentInput): Promise<string> {
  const ref = doc(commentsCollection(getDb()));
  await setDoc(
    ref,
    buildCommentData({
      entityKind: input.entityKind,
      entityId: input.entityId,
      municipalityId: input.municipalityId,
      authorUserId: input.authorUserId,
      body: input.body,
      createdAt: new Date(),
      parentCommentId: input.parentCommentId ?? null,
    }),
  );
  return ref.id;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/services/commentsService.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/models/interaction/CommentDataModel.ts packages/shared/src/services/commentsService.ts packages/shared/test/services/commentsService.test.ts
git commit -m "feat(comments): add parentCommentId and replyCount to comment model"
```

---

### Task 2: Dev backfill for existing comment docs

**Files:**
- Create: `scripts/backfill-comment-threading.mjs`

**Interfaces:**
- Consumes: firebase-admin SDK against `villa-events` (see `firebase-admin-dev` skill for credentials setup — mirror `scripts/backfill-municipality-namelower.mjs`'s structure: project-id guard, idempotent, only patches docs missing the field).

- [ ] **Step 1: Write the backfill script**

```js
#!/usr/bin/env node
// Backfills parentCommentId: null and replyCount: 0 onto existing comment
// docs that predate the comment-threading feature. Idempotent — only
// touches docs missing either field.
import admin from 'firebase-admin';

const PROJECT_ID = 'villa-events';

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

async function main() {
  if (process.env.GOOGLE_CLOUD_PROJECT !== PROJECT_ID && process.env.GCLOUD_PROJECT !== PROJECT_ID) {
    console.error(`Refusing to run: expected project ${PROJECT_ID}`);
    process.exit(1);
  }

  const snap = await db.collection('comments').get();
  let patched = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const update = {};
    if (!('parentCommentId' in data)) update.parentCommentId = null;
    if (!('replyCount' in data)) update.replyCount = 0;
    if (Object.keys(update).length > 0) {
      await docSnap.ref.update(update);
      patched++;
    }
  }
  console.log(`Patched ${patched}/${snap.size} comment docs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it against dev**

Run: `GOOGLE_APPLICATION_CREDENTIALS=<path from firebase-admin-dev skill> node scripts/backfill-comment-threading.mjs`
Expected: prints `Patched N/N comment docs.`

- [ ] **Step 3: Verify dev conformance**

Run: `pnpm check:dev-conformance`
Expected: no nonconforming `comments` docs reported.

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-comment-threading.mjs
git commit -m "chore(comments): add dev backfill for parentCommentId/replyCount"
```

---

### Task 3: Service — scope `getComments` to top-level, add `getReplies`

**Files:**
- Modify: `packages/shared/src/services/commentsService.ts`
- Test: `packages/shared/test/services/commentsService.test.ts`

**Interfaces:**
- Consumes: `CommentData` (Task 1) — `parentCommentId: string | null`.
- Produces: `getComments(entityKind, entityId, options?)` now returns only docs with `parentCommentId === null`. New `getReplies(entityKind: EntityKind, entityId: string, parentCommentId: string): Promise<(CommentData & { id: string })[]>`, ordered `createdAt asc`.

- [ ] **Step 1: Write the failing tests**

Add to `packages/shared/test/services/commentsService.test.ts`:

```ts
  it('getComments excludes replies (only parentCommentId === null)', async () => {
    const parentId = await addComment({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'Parent',
    });
    await addComment({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u2', body: 'Reply',
      parentCommentId: parentId,
    });
    const comments = await getComments('event', 'e1');
    expect(comments.map((c) => c.id)).toEqual([parentId]);
  });

  it('getReplies returns only replies to the given parent, oldest first', async () => {
    const parentId = await addComment({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'Parent',
    });
    const otherParentId = await addComment({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'Other parent',
    });
    const reply1 = await addComment({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u2', body: 'R1',
      parentCommentId: parentId,
    });
    const reply2 = await addComment({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u3', body: 'R2',
      parentCommentId: parentId,
    });
    await addComment({
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u4', body: 'Not ours',
      parentCommentId: otherParentId,
    });

    const replies = await getReplies('event', 'e1', parentId);
    expect(replies.map((r) => r.id)).toEqual([reply1, reply2]);
  });
```

Add `getReplies` to the imports at the top of the test file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/services/commentsService.test.ts`
Expected: FAIL — `getReplies` is not exported; `getComments` still returns replies.

- [ ] **Step 3: Implement**

`packages/shared/src/services/commentsService.ts`:

```ts
export async function getComments(
  entityKind: EntityKind,
  entityId: string,
  options: { limit?: number } = {},
): Promise<(CommentData & { id: string })[]> {
  const constraints = [
    where('entityKind', '==', entityKind),
    where('entityId', '==', entityId),
    where('parentCommentId', '==', null),
    orderBy('createdAt', 'asc'),
    ...(options.limit ? [fsLimit(options.limit)] : []),
  ];
  const q = query(commentsCollection(getDb()), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getReplies(
  entityKind: EntityKind,
  entityId: string,
  parentCommentId: string,
): Promise<(CommentData & { id: string })[]> {
  const q = query(
    commentsCollection(getDb()),
    where('entityKind', '==', entityKind),
    where('entityId', '==', entityId),
    where('parentCommentId', '==', parentCommentId),
    orderBy('createdAt', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/services/commentsService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/services/commentsService.ts packages/shared/test/services/commentsService.test.ts
git commit -m "feat(comments): scope getComments to top-level, add getReplies"
```

---

### Task 4: Firestore rules — validate `parentCommentId`/`replyCount`, enforce one-level nesting

**Files:**
- Modify: `firestore.rules` (the `isValidCommentCreate` function at `firestore.rules:389-398` and the `comments/{commentId}` match block at `firestore.rules:440-449`)
- Test: `packages/shared/test/e2e/interactionRules.test.ts`

**Interfaces:**
- Consumes: comment docs now require `parentCommentId` (string|null) and `replyCount` (must be `0` on create) per Task 1.

- [ ] **Step 1: Write the failing tests**

Add to `packages/shared/test/e2e/interactionRules.test.ts`. First update `validComment()` and `seedComment()` to include the new required fields:

```ts
function validComment(overrides: Record<string, unknown> = {}) {
  return {
    entityKind: 'event',
    entityId: 'e1',
    municipalityId: 'm1',
    authorUserId: 'alice',
    body: 'Hola!',
    createdAt: new Date(),
    parentCommentId: null,
    replyCount: 0,
    ...overrides,
  };
}
```

(and the same two keys added to `seedComment`'s default payload). Then add a new describe block:

```ts
describe('firestore.rules — /comments/{commentId} replies', () => {
  it('create fails when replyCount is nonzero', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, 'comments/c1'), validComment({ replyCount: 1 }))
    );
  });

  it('a reply can be created against an existing top-level comment', async () => {
    await seedComment('c1', 'alice', 'm1');
    const bob = asUser(getEnv(), 'bob');
    await assertSucceeds(
      setDoc(doc(bob, 'comments/c2'), validComment({ authorUserId: 'bob', parentCommentId: 'c1' }))
    );
  });

  it('a reply fails if parentCommentId points at a nonexistent comment', async () => {
    const bob = asUser(getEnv(), 'bob');
    await assertFails(
      setDoc(doc(bob, 'comments/c2'), validComment({ authorUserId: 'bob', parentCommentId: 'does-not-exist' }))
    );
  });

  it('a reply fails if the parent belongs to a different entity', async () => {
    await seedComment('c1', 'alice', 'm1', { entityId: 'e2' });
    const bob = asUser(getEnv(), 'bob');
    await assertFails(
      setDoc(doc(bob, 'comments/c2'), validComment({ authorUserId: 'bob', parentCommentId: 'c1' }))
    );
  });

  it('replying to a reply fails (one level of nesting only)', async () => {
    await seedComment('c1', 'alice', 'm1');
    await seedComment('c2', 'bob', 'm1', { parentCommentId: 'c1' });
    const carol = asUser(getEnv(), 'carol');
    await assertFails(
      setDoc(doc(carol, 'comments/c3'), validComment({ authorUserId: 'carol', parentCommentId: 'c2' }))
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:rules -- interactionRules`
Expected: FAIL — existing `hasOnly`/`hasAll` reject the new keys; no parent-check exists yet.

- [ ] **Step 3: Implement the rules change**

`firestore.rules` — replace `isValidCommentCreate` (currently lines 389-398):

```
    function isValidCommentCreate(d) {
      return d.keys().hasOnly(['entityKind', 'entityId', 'municipalityId', 'authorUserId', 'body', 'createdAt', 'parentCommentId', 'replyCount'])
          && d.keys().hasAll(['entityKind', 'entityId', 'municipalityId', 'authorUserId', 'body', 'createdAt', 'parentCommentId', 'replyCount'])
          && isValidEntityKind(d.entityKind)
          && isString(d.entityId)
          && isString(d.municipalityId)
          && isString(d.authorUserId)
          && isString(d.body) && d.body.size() > 0 && d.body.size() <= 2000
          && isTimestamp(d.createdAt)
          && (d.parentCommentId == null || isString(d.parentCommentId))
          && d.replyCount == 0
          && (d.parentCommentId == null || isValidReplyParent(d.entityKind, d.entityId, d.parentCommentId));
    }

    function isValidReplyParent(entityKind, entityId, parentCommentId) {
      let parent = get(/databases/$(database)/documents/comments/$(parentCommentId));
      return parent.data.entityKind == entityKind
          && parent.data.entityId == entityId
          && parent.data.parentCommentId == null;
    }
```

Use `get()`, not `getAfter()` — a reply's parent comment is always created in an earlier, separate `setDoc` call, never in the same write, so the already-committed doc is what needs checking.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:rules -- interactionRules`
Expected: PASS (including all previously-passing tests in this file, now with `parentCommentId`/`replyCount` in their payloads)

- [ ] **Step 5: Commit**

```bash
git add firestore.rules packages/shared/test/e2e/interactionRules.test.ts
git commit -m "feat(comments): validate parentCommentId/replyCount, enforce one-level nesting"
```

---

### Task 5: Firestore composite index

**Files:**
- Modify: `firestore.indexes.json` (the `comments` collectionGroup block at lines 248-256)

**Interfaces:**
- Consumes: `getComments`/`getReplies` (Task 3) both filter `entityKind, entityId, parentCommentId` and order by `createdAt`.

- [ ] **Step 1: Replace the composite index**

`firestore.indexes.json`:

```json
    {
      "collectionGroup": "comments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "entityKind", "order": "ASCENDING" },
        { "fieldPath": "entityId", "order": "ASCENDING" },
        { "fieldPath": "parentCommentId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    }
```

- [ ] **Step 2: Deploy the index to dev**

Use the `firestore-deploy` skill: `firebase deploy --only firestore:indexes` against `villa-events`. Indexes can take several minutes to build — check status with `firebase firestore:indexes` before relying on the new query shape in dev testing.

- [ ] **Step 3: Commit**

```bash
git add firestore.indexes.json
git commit -m "feat(comments): add parentCommentId to the comments composite index"
```

---

### Task 6: Notification model — `comment_reply` type + entity reference

**Files:**
- Modify: `packages/shared/src/models/notification/NotificationDataModel.ts`
- Test: `packages/shared/test/models/NotificationDataModel.test.ts` (create if it doesn't exist; check first — if a test file already exists for this model, extend it instead)

**Interfaces:**
- Produces: `NotificationType` gains `'comment_reply'`. `NotificationDataSchema`/`NotificationDataInput`/`buildNotificationData` gain `entityKind: EntityKind | null` and `entityId: string | null` (both nullable, defaulting to `null`, following the exact pattern already used for `eventId`/`municipalityId`/`requesterUid`).

- [ ] **Step 1: Check for an existing test file**

Run: `find packages/shared/test -iname "*NotificationDataModel*" -o -iname "*notification*"`. If a test file exists, add the new test cases there; otherwise create `packages/shared/test/models/NotificationDataModel.test.ts`.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildNotificationData } from '../../src/models/notification/NotificationDataModel';

describe('buildNotificationData', () => {
  it('defaults entityKind/entityId to null when not provided', () => {
    const n = buildNotificationData({ type: 'org_approved', title: 't', body: 'b' });
    expect(n.entityKind).toBeNull();
    expect(n.entityId).toBeNull();
  });

  it('accepts comment_reply with an entityKind/entityId pair', () => {
    const n = buildNotificationData({
      type: 'comment_reply', title: 't', body: 'b', entityKind: 'event', entityId: 'e1',
    });
    expect(n.type).toBe('comment_reply');
    expect(n.entityKind).toBe('event');
    expect(n.entityId).toBe('e1');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/models/NotificationDataModel.test.ts`
Expected: FAIL — `comment_reply` not a valid `NotificationType`; `entityKind`/`entityId` not on the built object.

- [ ] **Step 4: Implement**

`packages/shared/src/models/notification/NotificationDataModel.ts`:

```ts
import { z } from 'zod';
import { EntityKindSchema } from '../interaction/EntityKind';

export const NotificationTypeSchema = z.enum([
  'waitlist_promoted',
  'event_cancelled',
  'event_updated',
  'org_approved',
  'org_rejected',
  'organizer_request_created',
  'organizer_request_approved',
  'organizer_request_rejected',
  'comment_reply',
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationDataSchema = z.object({
  type: NotificationTypeSchema,
  title: z.string(),
  body: z.string(),
  eventId: z.string().nullable(),
  municipalityId: z.string().nullable(),
  requesterUid: z.string().nullable(),
  entityKind: EntityKindSchema.nullable(),
  entityId: z.string().nullable(),
  read: z.boolean(),
  createdAt: z.date(),
});
export type NotificationData = z.infer<typeof NotificationDataSchema>;

export interface NotificationDataInput {
  type: NotificationType;
  title: string;
  body: string;
  eventId?: string | null;
  municipalityId?: string | null;
  requesterUid?: string | null;
  entityKind?: z.infer<typeof EntityKindSchema> | null;
  entityId?: string | null;
  read?: boolean;
  createdAt?: Date;
}

export function buildNotificationData(input: NotificationDataInput): NotificationData {
  return {
    type: input.type,
    title: input.title,
    body: input.body,
    eventId: input.eventId ?? null,
    municipalityId: input.municipalityId ?? null,
    requesterUid: input.requesterUid ?? null,
    entityKind: input.entityKind ?? null,
    entityId: input.entityId ?? null,
    read: input.read ?? false,
    createdAt: input.createdAt ?? new Date(),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/models/NotificationDataModel.test.ts`
Expected: PASS

- [ ] **Step 6: Backfill existing dev notification docs**

`makeConverter`'s strict `schema.parse` fails on a *missing* key just as it does on a wrong-typed one — `.nullable()` requires the key present with value `null`, it does not make the key optional. Existing `users/*/notifications/*` docs predate `entityKind`/`entityId`, so they need the same treatment as Task 2. Extend `scripts/backfill-comment-threading.mjs` (from Task 2) with a second pass:

```js
async function backfillNotifications() {
  const snap = await db.collectionGroup('notifications').get();
  let patched = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const update = {};
    if (!('entityKind' in data)) update.entityKind = null;
    if (!('entityId' in data)) update.entityId = null;
    if (Object.keys(update).length > 0) {
      await docSnap.ref.update(update);
      patched++;
    }
  }
  console.log(`Patched ${patched}/${snap.size} notification docs.`);
}
```

Call `await backfillNotifications();` from `main()` alongside the existing comments backfill. Run:
`GOOGLE_APPLICATION_CREDENTIALS=<path from firebase-admin-dev skill> node scripts/backfill-comment-threading.mjs`, then `pnpm check:dev-conformance` to confirm no nonconforming `notifications` docs remain.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/models/notification/NotificationDataModel.ts packages/shared/test/models/NotificationDataModel.test.ts
git commit -m "feat(notifications): add comment_reply type and entity reference fields"
```

---

### Task 7: Cloud Function — `replyCount` sync + cascade delete

**Files:**
- Modify: `functions/src/interaction/syncEntityInteractionCounts.ts`
- Test: `functions/src/__tests__/handlers/interaction/syncEntityInteractionCounts.test.ts`

**Interfaces:**
- Consumes: `applyToParent` (existing, unchanged) for `commentCount`. New helper `applyToParentComment(db, parentCommentId, field, value)` for `replyCount`, mirroring the routing style of `applyToParent`.
- Produces: `syncEntityCommentCount` now also updates `replyCount` on the parent comment when the written doc has a non-null `parentCommentId`, and cascade-deletes replies when a top-level comment is deleted.

- [ ] **Step 1: Write the failing tests**

Add to `functions/src/__tests__/handlers/interaction/syncEntityInteractionCounts.test.ts`. First extend the `CommentShape` interface and `comment()` builder — also rename the existing `authorId` field to `authorUserId` to match the real `CommentDataModel` field name (the old name was never actually read by the trigger before this change; Task 8 needs the trigger to read `authorUserId`, so the fixture must use the same name as production):

```ts
interface CommentShape {
  entityKind: string;
  entityId: string;
  municipalityId: string;
  authorUserId: string;
  text: string;
  parentCommentId: string | null;
}

function comment(overrides: Partial<CommentShape> = {}): CommentShape {
  return {
    entityKind: 'event',
    entityId: 'e1',
    municipalityId: MUNICIPALITY_ID,
    authorUserId: 'user-1',
    text: 'hola',
    parentCommentId: null,
    ...overrides,
  };
}
```

No other test in this file references `authorId`, so this rename is safe and requires no other edits in Task 7.

Then add a new describe block:

```ts
describe('syncEntityCommentCount — replies', () => {
  it('increments the parent comment replyCount on reply create', async () => {
    await seedEvent('e1');
    await admin.firestore().doc('comments/parent-1').set({ replyCount: 0 });
    await fireCommentTrigger(null, comment({ parentCommentId: 'parent-1' }), 'reply-1');

    const parentDoc = await admin.firestore().doc('comments/parent-1').get();
    expect(parentDoc.get('replyCount')).toBe(1);
    const eventDoc = await admin.firestore().doc('events/e1').get();
    expect(eventDoc.get('commentCount')).toBe(1);
  });

  it('decrements the parent comment replyCount on reply delete', async () => {
    await seedEvent('e1', { commentCount: 1 });
    await admin.firestore().doc('comments/parent-1').set({ replyCount: 1 });
    await fireCommentTrigger(comment({ parentCommentId: 'parent-1' }), null, 'reply-1');

    const parentDoc = await admin.firestore().doc('comments/parent-1').get();
    expect(parentDoc.get('replyCount')).toBe(0);
  });

  it('cascade-deletes replies when their top-level parent is deleted', async () => {
    await seedEvent('e1', { commentCount: 3 });
    await admin.firestore().doc('comments/parent-1').set(comment());
    await admin.firestore().doc('comments/reply-a').set(comment({ parentCommentId: 'parent-1' }));
    await admin.firestore().doc('comments/reply-b').set(comment({ parentCommentId: 'parent-1' }));

    await fireCommentTrigger(comment(), null, 'parent-1');

    const replyA = await admin.firestore().doc('comments/reply-a').get();
    const replyB = await admin.firestore().doc('comments/reply-b').get();
    expect(replyA.exists).toBe(false);
    expect(replyB.exists).toBe(false);
    const eventDoc = await admin.firestore().doc('events/e1').get();
    expect(eventDoc.get('commentCount')).toBe(0); // parent (-1) + 2 cascaded replies (-2)
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:functions -- syncEntityInteractionCounts`
Expected: FAIL — `replyCount` untouched, no cascade delete happens.

- [ ] **Step 3: Implement**

`functions/src/interaction/syncEntityInteractionCounts.ts` — extend `syncEntityCommentCount`:

```ts
export const syncEntityCommentCount = onDocumentWritten(
  { document: 'comments/{commentId}', region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() ?? null;
    const after = event.data?.after.data() ?? null;
    if (!before && !after) return;
    let delta = 0;
    if (!before && after) delta = 1;
    else if (before && !after) delta = -1;
    if (delta === 0) return; // comments are immutable (rules), so only create/delete fire
    const d = after ?? before;
    if (!d) return;
    const entityKind = d['entityKind'] as string;
    const entityId = d['entityId'] as string;
    const municipalityId = d['municipalityId'] as string;
    const parentCommentId = d['parentCommentId'] as string | null;

    const result = await applyToParent(
      entityKind,
      entityId,
      municipalityId,
      'commentCount',
      FieldValue.increment(delta),
    );
    if (result === 'unknown-kind') {
      logger.warn('unknown entityKind for comment count', {
        handler: 'syncEntityCommentCount', entityKind,
      });
      return;
    }
    if (result === 'applied') {
      logger.info('comment count updated', {
        handler: 'syncEntityCommentCount', entityKind, entityId, delta,
      });
    }

    if (parentCommentId) {
      try {
        await db.doc(`comments/${parentCommentId}`).update('replyCount', FieldValue.increment(delta));
      } catch (err) {
        if (!isNotFound(err)) throw err;
        // parent already deleted (cascade in flight) — no-op
      }
    }

    // Cascade-delete replies when a top-level comment is deleted.
    if (delta === -1 && !parentCommentId) {
      const commentId = event.params.commentId;
      const repliesSnap = await db
        .collection('comments')
        .where('parentCommentId', '==', commentId)
        .get();
      if (!repliesSnap.empty) {
        const batch = db.batch();
        for (const replyDoc of repliesSnap.docs) batch.delete(replyDoc.ref);
        await batch.commit();
        logger.info('cascade-deleted replies for removed comment', {
          handler: 'syncEntityCommentCount', commentId, count: repliesSnap.size,
        });
      }
    }
  },
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:functions -- syncEntityInteractionCounts`
Expected: PASS — all existing tests in the file still pass alongside the new ones.

- [ ] **Step 5: Commit**

```bash
git add functions/src/interaction/syncEntityInteractionCounts.ts functions/src/__tests__/handlers/interaction/syncEntityInteractionCounts.test.ts
git commit -m "feat(comments): sync replyCount and cascade-delete replies on parent delete"
```

---

### Task 8: Cloud Function — notify the parent comment's author on reply

**Files:**
- Modify: `functions/src/interaction/syncEntityInteractionCounts.ts` (extend the same trigger — it already has the doc data in hand)
- Test: `functions/src/__tests__/handlers/interaction/syncEntityInteractionCounts.test.ts`

**Interfaces:**
- Consumes: `buildNotificationData` (Task 6), `userNotificationDoc`/`userNotificationsCollection` admin ref factory (existing — verify exact name in `packages/shared/src/firebase/refs/admin.ts` before use).

- [ ] **Step 1: Confirm the admin notification ref factory name**

Run: `grep -n "userNotification" packages/shared/src/firebase/refs/admin.ts`. Use whatever collection-ref factory it exports (matching the client-side `userNotificationDoc` seen in `refs/client.ts:121-122`) in the implementation step below — do not guess the name without checking.

- [ ] **Step 2: Write the failing test**

Add to the `syncEntityCommentCount — replies` describe block from Task 7:

```ts
  it('notifies the parent comment author on reply create', async () => {
    await seedEvent('e1', { title: 'Fiesta' });
    await admin.firestore().doc('comments/parent-1').set({
      ...comment(), authorUserId: 'parent-author', replyCount: 0,
    });
    await fireCommentTrigger(
      null,
      comment({ parentCommentId: 'parent-1', authorUserId: 'replier' }),
      'reply-1',
    );

    const notifs = await admin
      .firestore()
      .collection('users/parent-author/notifications')
      .get();
    expect(notifs.size).toBe(1);
    expect(notifs.docs[0].get('type')).toBe('comment_reply');
  });

  it('does not notify when replying to your own comment', async () => {
    await seedEvent('e1');
    await admin.firestore().doc('comments/parent-1').set({
      ...comment(), authorUserId: 'same-user', replyCount: 0,
    });
    await fireCommentTrigger(
      null,
      comment({ parentCommentId: 'parent-1', authorUserId: 'same-user' }),
      'reply-1',
    );

    const notifs = await admin
      .firestore()
      .collection('users/same-user/notifications')
      .get();
    expect(notifs.size).toBe(0);
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test:functions -- syncEntityInteractionCounts`
Expected: FAIL — no notification written yet.

- [ ] **Step 4: Implement**

Add inside the `if (parentCommentId) { ... }` block from Task 7's implementation, after the `replyCount` update succeeds and only on create (`delta === 1`):

```ts
    if (parentCommentId && delta === 1) {
      try {
        const parentSnap = await db.doc(`comments/${parentCommentId}`).get();
        const parentAuthorUserId = parentSnap.get('authorUserId') as string | undefined;
        const replyAuthorUserId = d['authorUserId'] as string;
        if (parentAuthorUserId && parentAuthorUserId !== replyAuthorUserId) {
          await db
            .collection(`users/${parentAuthorUserId}/notifications`)
            .doc()
            .set(
              buildNotificationData({
                type: 'comment_reply',
                title: 'Nueva respuesta a tu comentario',
                body: (d['body'] as string).slice(0, 200),
                entityKind: entityKind as EntityKind,
                entityId,
                municipalityId,
              }),
            );
        }
      } catch (err) {
        if (!isNotFound(err)) throw err;
      }
    }
```

Add the necessary imports (`buildNotificationData`, `EntityKind`) at the top of the file.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:functions -- syncEntityInteractionCounts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/src/interaction/syncEntityInteractionCounts.ts functions/src/__tests__/handlers/interaction/syncEntityInteractionCounts.test.ts
git commit -m "feat(comments): notify parent comment author on reply, skip self-replies"
```

---

### Task 9: i18n strings for reply UI

**Files:**
- Modify: `packages/i18n/messages/es.json` (the `comments` namespace at lines 1005-1017)

- [ ] **Step 1: Add the new keys**

```json
  "comments": {
    "sectionTitle": "Comentarios",
    "countLabel": "{count, plural, one {# comentario} other {# comentarios}}",
    "placeholder": "Escribe un comentario…",
    "send": "Enviar",
    "signInToComment": "Inicia sesión para comentar",
    "delete": "Eliminar",
    "deleteConfirmTitle": "Eliminar comentario",
    "deleteConfirmMessage": "¿Eliminar este comentario?",
    "deleteConfirmCancel": "Cancelar",
    "deleteConfirmConfirm": "Eliminar",
    "anonymousAuthor": "Usuario",
    "reply": "Responder",
    "replyPlaceholder": "Escribe una respuesta…",
    "viewReplies": "{count, plural, one {Ver # respuesta} other {Ver # respuestas}}",
    "hideReplies": "Ocultar respuestas"
  }
```

- [ ] **Step 2: Verify i18n typecheck**

Run: `pnpm typecheck` (or the narrower i18n package check if one exists — check `packages/i18n/package.json` scripts).
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "i18n(comments): add reply UI strings"
```

---

### Task 10: Mobile UI — reply action, inline composer, view-replies toggle

**Files:**
- Modify: `apps/mobile/components/feature/EntityComments.tsx`

**Interfaces:**
- Consumes: `getReplies` (Task 3), `addComment` with `parentCommentId` (Task 1), i18n keys `comments.reply`/`comments.replyPlaceholder`/`comments.viewReplies`/`comments.hideReplies` (Task 9).

- [ ] **Step 1: Add per-comment reply state**

Add local state to track which top-level comment (if any) has its inline reply composer open, and a `Map<commentId, CommentDoc[]>` of loaded replies plus a `Set<commentId>` of expanded comment ids:

```ts
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [repliesByParent, setRepliesByParent] = useState<Map<string, CommentDoc[]>>(new Map());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
```

- [ ] **Step 2: Add the toggle handler that lazy-loads replies**

```ts
  const onToggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
        return next;
      }
      next.add(commentId);
      if (!repliesByParent.has(commentId)) {
        setLoadingReplies((p) => new Set(p).add(commentId));
        void (async () => {
          const replies = await getReplies(entityKind, entityId, commentId);
          setRepliesByParent((prev2) => new Map(prev2).set(commentId, replies));
          setLoadingReplies((p) => {
            const n = new Set(p);
            n.delete(commentId);
            return n;
          });
        })();
      }
      return next;
    });
  };
```

Add `getReplies` to the `commentsService` import.

- [ ] **Step 3: Add the reply-send handler**

```ts
  const onSendReply = (parentCommentId: string) => {
    if (!user) return;
    const trimmed = replyBody.trim();
    if (!trimmed) return;
    void (async () => {
      const id = await addComment({
        entityKind, entityId, municipalityId, authorUserId: user.uid, body: trimmed, parentCommentId,
      });
      const newReply: CommentDoc = {
        id, entityKind, entityId, municipalityId, authorUserId: user.uid, body: trimmed,
        createdAt: new Date(), parentCommentId, replyCount: 0,
      };
      setRepliesByParent((prev) => {
        const next = new Map(prev);
        next.set(parentCommentId, [...(next.get(parentCommentId) ?? []), newReply]);
        return next;
      });
      setComments((prev) =>
        prev.map((c) => (c.id === parentCommentId ? { ...c, replyCount: c.replyCount + 1 } : c)),
      );
      setExpandedReplies((prev) => new Set(prev).add(parentCommentId));
      setReplyingTo(null);
      setReplyBody('');
    })();
  };
```

- [ ] **Step 4: Render the "Reply" action, "View N replies" toggle, and inline composer**

Inside the `comments.map((comment) => { ... })` render, after the existing delete `Pressable` (still within the same `HStack`'s parent `VStack`, i.e. restructure the per-comment block to a `VStack` wrapping the existing `HStack` plus the new reply UI):

```tsx
            return (
              <VStack key={comment.id} gap={1}>
                <HStack gap={2} align="start" justify="between">
                  <Avatar uri={author?.photoURL ?? null} size={36} initials={initialsOf(name)} />
                  <VStack gap={1} className="flex-1">
                    <Text>
                      <Text className="font-bold">{name}</Text> {comment.body}
                    </Text>
                    <HStack gap={3}>
                      <Text variant="caption" tone="muted">
                        {formatRelativeTime(comment.createdAt)}
                      </Text>
                      {user ? (
                        <Pressable onPress={() => setReplyingTo(comment.id)}>
                          <Text variant="caption" tone="muted">{t('comments.reply')}</Text>
                        </Pressable>
                      ) : null}
                    </HStack>
                  </VStack>
                  {canDelete ? (
                    <Pressable
                      onPress={() => onDelete(comment.id)}
                      accessibilityRole="button"
                      accessibilityLabel={t('comments.delete')}
                      className="p-1"
                    >
                      <Ionicons name="trash-outline" size={iconSizes.sm} color={colors.light.fg.muted} />
                    </Pressable>
                  ) : null}
                </HStack>

                {replyingTo === comment.id ? (
                  <HStack gap={2} align="center" className="pl-10">
                    <View className="flex-1">
                      <Input
                        value={replyBody}
                        onChangeText={setReplyBody}
                        placeholder={t('comments.replyPlaceholder')}
                        accessibilityLabel={t('comments.replyPlaceholder')}
                      />
                    </View>
                    <Button onPress={() => onSendReply(comment.id)} disabled={!replyBody.trim()}>
                      {t('comments.send')}
                    </Button>
                  </HStack>
                ) : null}

                {comment.replyCount > 0 ? (
                  <Pressable onPress={() => onToggleReplies(comment.id)} className="pl-10">
                    <Text variant="caption" tone="muted">
                      {expandedReplies.has(comment.id)
                        ? t('comments.hideReplies')
                        : t('comments.viewReplies', { count: comment.replyCount })}
                    </Text>
                  </Pressable>
                ) : null}

                {expandedReplies.has(comment.id) ? (
                  loadingReplies.has(comment.id) ? (
                    <View className="pl-10 py-2">
                      <ActivityIndicator size="small" />
                    </View>
                  ) : (
                    <VStack gap={2} className="pl-10">
                      {(repliesByParent.get(comment.id) ?? []).map((reply) => {
                        const replyAuthor = authors.get(reply.authorUserId);
                        const replyName = replyAuthor?.name ?? t('comments.anonymousAuthor');
                        const canDeleteReply = reply.authorUserId === user?.uid || canModerate;
                        return (
                          <HStack key={reply.id} gap={2} align="start" justify="between">
                            <Avatar uri={replyAuthor?.photoURL ?? null} size={28} initials={initialsOf(replyName)} />
                            <VStack gap={1} className="flex-1">
                              <Text>
                                <Text className="font-bold">{replyName}</Text> {reply.body}
                              </Text>
                              <Text variant="caption" tone="muted">
                                {formatRelativeTime(reply.createdAt)}
                              </Text>
                            </VStack>
                            {canDeleteReply ? (
                              <Pressable
                                onPress={() => onDelete(reply.id)}
                                accessibilityRole="button"
                                accessibilityLabel={t('comments.delete')}
                                className="p-1"
                              >
                                <Ionicons name="trash-outline" size={iconSizes.sm} color={colors.light.fg.muted} />
                              </Pressable>
                            ) : null}
                          </HStack>
                        );
                      })}
                    </VStack>
                  )
                ) : null}
              </VStack>
            );
```

- [ ] **Step 5: Extend the author-resolution effect to cover reply authors**

Replies loaded via `getReplies` won't have their author metadata pre-resolved — the existing `authors` effect only watches `comments` (the top-level list). Extend its uid-gathering to also pull from `repliesByParent`:

```ts
  useEffect(() => {
    const replyAuthorIds = [...repliesByParent.values()].flat().map((r) => r.authorUserId);
    const unresolved = [...new Set([...comments.map((c) => c.authorUserId), ...replyAuthorIds])].filter(
      (uid) => !authors.has(uid),
    );
    if (unresolved.length === 0) return;
    // ...rest of the effect body is unchanged...
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, repliesByParent, t]);
```

Only the first three lines and the dependency array change; the `Promise.all(...)`/`setAuthors(...)` body stays exactly as it is today.

- [ ] **Step 6: Also update the optimistic top-level `addComment` insert**

The existing `onSend` handler's optimistic insert (around line 134-137) constructs a `CommentDoc` literal missing the two new required `CommentData` fields — update it:

```ts
        setComments((prev) => [
          ...prev,
          {
            id, entityKind, entityId, municipalityId, authorUserId: user.uid, body: trimmed,
            createdAt: new Date(), parentCommentId: null, replyCount: 0,
          },
        ]);
```

- [ ] **Step 7: Manual verification**

Per AGENTS.md, UI changes need an in-browser check, not just a typecheck. Run `pnpm --filter cultuvilla-mobile exec expo start` yourself is off-limits (long-lived dev server) — ask the user to run it and confirm: reply action appears, inline composer posts a reply, "View N replies" lazy-loads and toggles, replies don't show their own "Reply" action, deleting a top-level comment with replies also removes its replies from view (after a refresh, since the cascade delete is server-side).

- [ ] **Step 8: Run mobile typecheck**

Run: `pnpm app:typecheck`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/components/feature/EntityComments.tsx
git commit -m "feat(comments): add reply UI - inline composer, view-replies toggle"
```

---

### Task 11: Docs sync

**Files:**
- Modify: `packages/shared/src/services/_services-map.md`
- Modify: `docs/architecture/denormalized-read-models.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update `_services-map.md`**

Find the `commentsService` entry and note the new `getReplies` export and the `parentCommentId`-based scoping of `getComments`.

- [ ] **Step 2: Update `denormalized-read-models.md`**

Find the existing `commentCount` entry (around lines 131-158) and add a `replyCount` entry alongside it: source of truth is still `comments/`, same trigger (`syncEntityCommentCount`), target is the parent comment doc rather than the entity doc, backfill script is `scripts/backfill-comment-threading.mjs`.

- [ ] **Step 3: Add a CHANGELOG entry**

Under `## [Unreleased]`:

```markdown
### Added
- Comment replies: reply to a specific comment (one level of nesting), with a "View N replies" toggle and a notification to the parent comment's author.

**Migration:** existing `comments/` docs are backfilled with `parentCommentId: null` and `replyCount: 0` by re-running `scripts/backfill-comment-threading.mjs` (per env).
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/services/_services-map.md docs/architecture/denormalized-read-models.md CHANGELOG.md
git commit -m "docs(comments): document replyCount denormalization and reply threading"
```
