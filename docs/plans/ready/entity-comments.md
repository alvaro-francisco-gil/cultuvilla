# Entity comments, reactions & counts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task ends with `pnpm --filter @cultuvilla/shared test` / `pnpm test:rules` / `pnpm test:functions` / `pnpm app:typecheck` as noted and a commit.

**Goal:** Let anyone browsing the app read and post flat comments and like/heart reactions on all six village entities (event, festival-poster, place, barrio, organization, news), with comment/reaction counts denormalized onto each entity and surfaced on cards + detail screens.

**Architecture:** Two new generic top-level Firestore collections — `comments` and `reactions` — each carrying `(entityKind, entityId, municipalityId)`. One `commentsService` in `@cultuvilla/shared`. Public read, authenticated create, owner/village-admin/app-admin delete for comments (owner-only for reactions), all enforced in `firestore.rules`. Counts are denormalized onto each entity doc (`commentCount`, `reactionCounts: {like, heart}`) by one entityKind-routing Cloud Function trigger. One shared `<EntityComments>` React component drops into the `EntityDetailScaffold` children of all six detail screens. The pre-existing **news-only** comment/reaction/report backend is deleted and folded into this generic system (delete > deprecate).

**Tech Stack:** TypeScript (strict), Zod models + `makeConverter`, Firebase Firestore (client + admin SDK), Firebase Functions v2 (`onDocumentWritten`), Vitest (shared + `@firebase/rules-unit-testing` e2e), Jest (functions + mobile), Expo / React Native / NativeWind (mobile UI), `@cultuvilla/i18n`.

## Global Constraints

- **Service-layer ownership:** no `firebase/firestore` imports outside `packages/shared/src/services/` (ESLint-gated in shared/functions; convention in mobile). All Firestore access via `commentsService`.
- **Strict TS, no `any`, no `@ts-nocheck`.** `@typescript-eslint/no-explicit-any` is an error in shared + functions.
- **Cloud Functions logging:** never `console.*`; use `logger.info/warn/error(msg, { handler, ...fields })` with a `handler` field. Enforced by `functions/src/__tests__/helpers/no-console.test.ts`.
- **Top-level collections scoped by `municipalityId`;** every new query shape needs a composite index in `firestore.indexes.json` in the same change.
- **Backfill dev when a schema field is added** (reads use a strict Zod converter that throws on missing fields): required entity-doc fields must be backfilled in `villa-events` in the same change and verified with `pnpm check:dev-conformance`. Dev backfill is autonomous; beta/prod are off-limits.
- **Delete > deprecate:** remove the news-specific comment/reaction/report code entirely; no shim re-exports or `// removed:` comments.
- **i18n:** user-facing strings go through `useT()`; add to `packages/i18n/messages/es.json`.
- **Design tokens / primitives:** new mobile UI composes primitives (`VStack`, `HStack`, `Text`, `Pressable`, `Button`, `Input`) and semantic Tailwind classes; icon sizes via `iconSizes.*`. Respect `insets.bottom` for any bottom-anchored input.
- **Commits:** conventional commits, header ≤ 100 chars, scope `comments` (e.g. `feat(comments): …`).

---

## Context / design rationale

Investigation found a **complete comments + reactions + reports backend that exists only for `news`** (`newsComments` / `newsReactions` / `newsReports`, functions in `newsService.ts`, matching rules, one index, and `syncNewsCommentCount` / `syncNewsReactionCounts` triggers). It is **never wired into any UI** — not even for news — and its read rules gate to village members, which is *more* restrictive than the entities it attaches to. All entity docs are already publicly readable (`allow read: if true` on `events` `firestore.rules:721`, `organizations` :675, `festivalPosters` :790, approved `news` :436, and nested `barrios`/`places` under `municipalities`). So this work generalizes a known-good, tested pattern, builds the first comment UI, and fixes the visibility inconsistency. The user confirmed there is no real comment data to migrate.

**Entity parents are heterogeneous** (this shapes the count trigger and the rules ripple):

| entityKind | parent doc path | create validator (`firestore.rules`) | match block |
|---|---|---|---|
| `event` | `events/{id}` (top-level) | `isValidEventCreate` :391 | :721 |
| `organization` | `organizations/{id}` (top-level) | `isValidOrganizationCreate` :278 | :675 |
| `festivalPoster` | `festivalPosters/{id}` (top-level) | `isValidFestivalPosterProposalCreate` :338 | :790 |
| `news` | `news/{id}` (top-level) | `isValidNewsPostCreate` | :436 |
| `place` | `municipalities/{municipalityId}/places/{id}` (**nested**) | `isValidPlaceProposalCreate` :317 | :580 |
| `barrio` | `municipalities/{municipalityId}/barrios/{id}` (**nested**) | `isValidBarrioProposalCreate` :372 | :560 |

`news` **already** carries `commentCount` + `reactionCounts:{like,heart}` (its model, factory, create rule enforcing `==0`, and update-mutation block already exist), so Stage C adds those fields only to the other **five** entities. The generic trigger routes all six — including news — to their parent doc; the old news-specific triggers are deleted.

### Key decisions (resolved)

- **Counts are denormalized, not aggregation-queried** — per architecture invariant #4 (denormalized read models for high fan-out); a card feed doing one count query per card is exactly the N-reads case that invariant exists to avoid. Reaction counts use the news `reactionCounts: {like, heart}` **map** shape for parity and to power the per-kind reaction bar directly off the entity doc.
- **Everyone reads; any signed-in user posts.** No village-membership gate (fixes the old inconsistency). Posting needs auth for `authorUserId`.
- **Moderation = hard delete via rules.** Owner, village-admin (of the comment's `municipalityId`), or app-admin may delete a comment. No `hidden` flag, no moderation callable, no `reports` collection. Reaction delete is owner-only.
- **Flat comments, no threads.**
- **`EntityKind` is promoted to `@cultuvilla/shared`** (single source of truth); the mobile `registry.ts` union re-imports it.

### Data model

```
comments   { entityKind, entityId, municipalityId, authorUserId, body, createdAt }
reactions  { entityKind, entityId, municipalityId, userId, kind }   // doc id: `${entityKind}_${entityId}_${userId}`
```

Entity docs gain: `commentCount: number` and `reactionCounts: { like: number, heart: number }` (news already has both).

---

## File Structure

**Create:**
- `packages/shared/src/models/interaction/EntityKind.ts` — `ENTITY_KINDS`, `EntityKindSchema`, `EntityKind` type.
- `packages/shared/src/models/interaction/CommentDataModel.ts` — schema, type, `buildCommentData`.
- `packages/shared/src/models/interaction/ReactionDataModel.ts` — schema, type, `ReactionKindSchema`, `ReactionCountsSchema`, `reactionDocId`, `buildReactionData`.
- `packages/shared/src/models/interaction/index.ts` — barrel.
- `packages/shared/src/firebase/converters/commentConverter.client.ts` / `.admin.ts`
- `packages/shared/src/firebase/converters/reactionConverter.client.ts` / `.admin.ts`
- `packages/shared/src/services/commentsService.ts`
- `packages/shared/test/services/commentsService.test.ts`
- `packages/shared/test/e2e/interactionRules.test.ts`
- `functions/src/interaction/syncEntityInteractionCounts.ts` — the two routing triggers + `parentRef` helper.
- `functions/src/__tests__/interaction/syncEntityInteractionCounts.test.ts`
- `scripts/backfill-entity-comment-counts.mjs`
- `apps/mobile/components/feature/EntityComments.tsx`
- `apps/mobile/components/feature/ReactionBar.tsx`

**Modify:**
- `packages/shared/src/firebase/refs/client.ts` / `refs/admin.ts` — add `comments*` / `reactions*` refs; remove `newsComments*` / `newsReactions*` / `newsReports*` refs.
- `packages/shared/src/models/index.ts` (or the models barrel) — export `interaction`.
- `packages/shared/src/models/event/EventDataModel.ts`, `organization/OrganizationDataModel.ts`, `festivalPoster/FestivalPosterDataModel.ts`, and the place + barrio models — add count fields + factory defaults.
- `packages/shared/src/services/newsService.ts` — delete `reactToPost`, `removeReaction`, `getMyReaction`, `addComment`, `deleteOwnComment`, `getComments`, `reportComment` and their now-unused imports/types.
- `packages/shared/src/services/_services-map.md` — document `commentsService`; remove the deleted news functions.
- `functions/src/index.ts` — export the two new triggers; remove the two news exports.
- `firestore.rules` — add `comments`/`reactions` match blocks + `isValidCommentCreate`/`isValidReactionWrite`/`isValidEntityKind`; remove `newsComments`/`newsReactions`/`newsReports` blocks + their validators; add count fields to the five entity create-validators and block their mutation on update.
- `firestore.indexes.json` — add `comments (entityKind, entityId, createdAt)`; remove `newsComments` + `newsReports` indexes.
- `apps/mobile/lib/entities/registry.ts` — re-import `EntityKind`/`ENTITY_KINDS` from shared.
- The six detail screens: `apps/mobile/app/event/[eventId].tsx`, `app/news/[newsId].tsx`, `app/o/[orgId]/index.tsx`, `app/village/[villageId]/place/[id].tsx`, `.../barrio/[id].tsx`, `.../festival-poster/[id].tsx` — add `<EntityComments>`.
- `apps/mobile/components/feature/FeedCard.tsx` (+ `EventCard.tsx`, `NewsCard.tsx`, and other card wrappers) — comment-count meta.
- `packages/i18n/messages/es.json` — `comments.*` strings.
- `CHANGELOG.md` — `[Unreleased]` entry.
- `docs/architecture/denormalized-read-models.md` — note the new `commentCount`/`reactionCounts` read model.

**Delete:**
- `packages/shared/src/models/news/NewsCommentDataModel.ts`, `NewsReactionDataModel.ts`, `NewsReportDataModel.ts` (and their exports from `models/news/index.ts`).
- `packages/shared/src/firebase/converters/newsComment*`, `newsReaction*`, `newsReport*`.
- `functions/src/news/syncNewsCommentCount.ts`, `syncNewsReactionCounts.ts`.
- News comment/reaction portions of `packages/shared/test/services/newsService.test.ts` and `packages/shared/test/e2e/newsRules.test.ts`.
- If left unused after the deletions: `NewsReactionKindSchema` / `NewsReactionCounts` exports in `NewsPostDataModel.ts` **only if** the news post model no longer references them (news keeps its own `reactionCounts` field — verify before removing).

---

## Stage A — Shared data layer & service

### Task A1: `EntityKind` in shared

**Files:**
- Create: `packages/shared/src/models/interaction/EntityKind.ts`
- Test: `packages/shared/test/models/entityKind.test.ts`

**Interfaces — Produces:** `ENTITY_KINDS: readonly EntityKind[]`, `EntityKindSchema: z.ZodEnum`, `type EntityKind`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/test/models/entityKind.test.ts
import { describe, it, expect } from 'vitest';
import { ENTITY_KINDS, EntityKindSchema } from '../../src/models/interaction/EntityKind';

describe('EntityKind', () => {
  it('lists all six entity kinds', () => {
    expect([...ENTITY_KINDS].sort()).toEqual(
      ['barrio', 'event', 'festivalPoster', 'news', 'organization', 'place'].sort(),
    );
  });
  it('schema accepts a valid kind and rejects an invalid one', () => {
    expect(EntityKindSchema.parse('event')).toBe('event');
    expect(() => EntityKindSchema.parse('user')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared test entityKind`
Expected: FAIL — cannot find module `EntityKind`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/shared/src/models/interaction/EntityKind.ts
import { z } from 'zod';

/** The six village-scoped entities that support comments + reactions. */
export const ENTITY_KINDS = [
  'event',
  'festivalPoster',
  'place',
  'barrio',
  'organization',
  'news',
] as const;

export const EntityKindSchema = z.enum(ENTITY_KINDS);
export type EntityKind = z.infer<typeof EntityKindSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared test entityKind` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/interaction/EntityKind.ts packages/shared/test/models/entityKind.test.ts
git commit -m "feat(comments): add shared EntityKind enum"
```

### Task A2: Comment + Reaction models

**Files:**
- Create: `packages/shared/src/models/interaction/CommentDataModel.ts`, `ReactionDataModel.ts`, `index.ts`
- Modify: the models barrel (`packages/shared/src/models/index.ts`) to `export * from './interaction';`
- Test: `packages/shared/test/models/interaction.test.ts`

**Interfaces — Produces:**
- `buildCommentData(input): CommentData`, `CommentData`, `CommentDataSchema`
- `buildReactionData(input): ReactionData`, `ReactionData`, `ReactionKindSchema`, `type ReactionKind`, `ReactionCountsSchema`, `type ReactionCounts`, `reactionDocId(entityKind, entityId, userId): string`

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/test/models/interaction.test.ts
import { describe, it, expect } from 'vitest';
import { buildCommentData } from '../../src/models/interaction/CommentDataModel';
import { buildReactionData, reactionDocId, ReactionCountsSchema } from '../../src/models/interaction/ReactionDataModel';

describe('CommentData', () => {
  it('builds a comment carrying its entity coordinates', () => {
    const now = new Date();
    const c = buildCommentData({ entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'Hola', createdAt: now });
    expect(c).toEqual({ entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'Hola', createdAt: now });
  });
});

describe('ReactionData', () => {
  it('doc id is entityKind_entityId_userId', () => {
    expect(reactionDocId('place', 'p1', 'u1')).toBe('place_p1_u1');
  });
  it('builds a reaction', () => {
    const now = new Date();
    const r = buildReactionData({ entityKind: 'news', entityId: 'n1', municipalityId: 'm1', userId: 'u1', kind: 'heart', createdAt: now });
    expect(r.kind).toBe('heart');
  });
  it('ReactionCountsSchema validates a like/heart pair', () => {
    expect(ReactionCountsSchema.parse({ like: 2, heart: 1 })).toEqual({ like: 2, heart: 1 });
    expect(() => ReactionCountsSchema.parse({ like: 2 })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared test interaction` → FAIL (missing modules).

- [ ] **Step 3: Write the implementations**

```ts
// packages/shared/src/models/interaction/CommentDataModel.ts
import { z } from 'zod';
import { EntityKindSchema } from './EntityKind';

export const CommentDataSchema = z.object({
  entityKind: EntityKindSchema,
  entityId: z.string(),
  municipalityId: z.string(),
  authorUserId: z.string(),
  body: z.string().min(1).max(2000),
  createdAt: z.date(),
});
export type CommentData = z.infer<typeof CommentDataSchema>;

export interface CommentDataInput {
  entityKind: z.infer<typeof EntityKindSchema>;
  entityId: string;
  municipalityId: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
}

export function buildCommentData(input: CommentDataInput): CommentData {
  return {
    entityKind: input.entityKind,
    entityId: input.entityId,
    municipalityId: input.municipalityId,
    authorUserId: input.authorUserId,
    body: input.body,
    createdAt: input.createdAt,
  };
}
```

```ts
// packages/shared/src/models/interaction/ReactionDataModel.ts
import { z } from 'zod';
import { EntityKindSchema, type EntityKind } from './EntityKind';

export const ReactionKindSchema = z.enum(['like', 'heart']);
export type ReactionKind = z.infer<typeof ReactionKindSchema>;

/** Denormalized per-kind counters kept on each entity doc. */
export const ReactionCountsSchema = z.object({
  like: z.number().int(),
  heart: z.number().int(),
});
export type ReactionCounts = z.infer<typeof ReactionCountsSchema>;

export const ReactionDataSchema = z.object({
  entityKind: EntityKindSchema,
  entityId: z.string(),
  municipalityId: z.string(),
  userId: z.string(),
  kind: ReactionKindSchema,
  createdAt: z.date(),
});
export type ReactionData = z.infer<typeof ReactionDataSchema>;

export interface ReactionDataInput {
  entityKind: EntityKind;
  entityId: string;
  municipalityId: string;
  userId: string;
  kind: ReactionKind;
  createdAt: Date;
}

export function reactionDocId(entityKind: EntityKind, entityId: string, userId: string): string {
  return `${entityKind}_${entityId}_${userId}`;
}

export function buildReactionData(input: ReactionDataInput): ReactionData {
  return {
    entityKind: input.entityKind,
    entityId: input.entityId,
    municipalityId: input.municipalityId,
    userId: input.userId,
    kind: input.kind,
    createdAt: input.createdAt,
  };
}
```

```ts
// packages/shared/src/models/interaction/index.ts
export * from './EntityKind';
export * from './CommentDataModel';
export * from './ReactionDataModel';
```

Then add `export * from './interaction';` to the models barrel (`packages/shared/src/models/index.ts`). Note: `ReactionCountsSchema` itself has no built-in default — each entity factory applies the `{ like: 0, heart: 0 }` default in Stage C.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared test interaction` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/interaction packages/shared/src/models/index.ts packages/shared/test/models/interaction.test.ts
git commit -m "feat(comments): add Comment + Reaction shared models"
```

### Task A3: Converters + refs

**Files:**
- Create: `commentConverter.client.ts` / `.admin.ts`, `reactionConverter.client.ts` / `.admin.ts` under `packages/shared/src/firebase/converters/`
- Modify: `packages/shared/src/firebase/refs/client.ts`, `refs/admin.ts`

**Interfaces — Produces (client refs):** `commentsCollection(db)`, `commentDoc(db, id)`, `reactionsCollection(db)`, `reactionDoc(db, id)`; admin equivalents with the same names.

- [ ] **Step 1: Write the four converters** (mirror the news converter one-liners):

```ts
// commentConverter.client.ts
import { CommentDataSchema } from '../../models/interaction/CommentDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
export const commentConverterClient = makeConverter(CommentDataSchema, clientSdkCtors);
```
```ts
// commentConverter.admin.ts
import { CommentDataSchema } from '../../models/interaction/CommentDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';
export const commentConverterAdmin = makeConverter(CommentDataSchema, adminSdkCtors);
```
```ts
// reactionConverter.client.ts
import { ReactionDataSchema } from '../../models/interaction/ReactionDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
export const reactionConverterClient = makeConverter(ReactionDataSchema, clientSdkCtors);
```
```ts
// reactionConverter.admin.ts
import { ReactionDataSchema } from '../../models/interaction/ReactionDataModel';
import { makeConverter } from './makeConverter';
import { adminSdkCtors } from './sdkAdapters.admin';
export const reactionConverterAdmin = makeConverter(ReactionDataSchema, adminSdkCtors);
```

- [ ] **Step 2: Add refs to `refs/client.ts`** (near the old news refs, ~line 124), importing the client converters at the top:

```ts
export const commentsCollection = (db: Firestore) =>
  collection(db, 'comments').withConverter(commentConverterClient);
export const commentDoc = (db: Firestore, commentId: string) =>
  doc(db, 'comments', commentId).withConverter(commentConverterClient);
export const reactionsCollection = (db: Firestore) =>
  collection(db, 'reactions').withConverter(reactionConverterClient);
export const reactionDoc = (db: Firestore, reactionId: string) =>
  doc(db, 'reactions', reactionId).withConverter(reactionConverterClient);
```

- [ ] **Step 3: Add the admin equivalents to `refs/admin.ts`** using `db.collection('comments')` / `.doc()` and the admin converters.

- [ ] **Step 4: Delete the `newsComments*` / `newsReactions*` / `newsReports*` refs** from both files and delete the `newsComment*` / `newsReaction*` / `newsReport*` converter files. (Typecheck will flag `newsService.ts` — fixed in A5.)

- [ ] **Step 5: Typecheck (shared will error until A4/A5) — defer commit to A5.** No standalone commit; converters+refs land with the service in A5's history if needed. (If you prefer a green intermediate, comment out the news ref deletions until A5, then delete.) Recommended: proceed straight to A4/A5, then run `pnpm --filter @cultuvilla/shared typecheck`.

### Task A4: `commentsService`

**Files:**
- Create: `packages/shared/src/services/commentsService.ts`
- Test: `packages/shared/test/services/commentsService.test.ts`

**Interfaces — Produces:**
```ts
addComment(input: { entityKind: EntityKind; entityId: string; municipalityId: string; authorUserId: string; body: string }): Promise<string>
deleteComment(commentId: string): Promise<void>
getComments(entityKind: EntityKind, entityId: string, options?: { limit?: number }): Promise<(CommentData & { id: string })[]>
reactToEntity(input: { entityKind: EntityKind; entityId: string; municipalityId: string; userId: string; kind: ReactionKind }): Promise<void>
removeReaction(entityKind: EntityKind, entityId: string, userId: string): Promise<void>
getMyReaction(entityKind: EntityKind, entityId: string, userId: string): Promise<ReactionKind | null>
```

- [ ] **Step 1: Write the failing test.** Copy the `vi.mock('firebase/firestore', …)` in-memory-fake harness verbatim from `packages/shared/test/services/newsService.test.ts` (lines 1–224 of that file — the `store`/`makeFakeDocRef`/`query`/`getDocs` fake). Then:

```ts
import { addComment, deleteComment, getComments, reactToEntity, removeReaction, getMyReaction } from '../../src/services/commentsService';

describe('commentsService — comments', () => {
  beforeEach(() => { store = {}; idCounter = 0; });

  it('addComment writes a doc under comments with the entity coordinates', async () => {
    const id = await addComment({ entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'Hola pueblo!' });
    expect(id).toBeTruthy();
    const snap = store[`comments/${id}`];
    expect(snap['entityKind']).toBe('event');
    expect(snap['entityId']).toBe('e1');
    expect(snap['body']).toBe('Hola pueblo!');
  });

  it('deleteComment removes the doc', async () => {
    const id = await addComment({ entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'X' });
    await deleteComment(id);
    expect(store[`comments/${id}`]).toBeUndefined();
  });

  it('getComments filters by entityKind + entityId', async () => {
    const a = await addComment({ entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'A' });
    await addComment({ entityKind: 'event', entityId: 'e2', municipalityId: 'm1', authorUserId: 'u1', body: 'B' });
    await addComment({ entityKind: 'place', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'C' });
    const got = await getComments('event', 'e1');
    expect(got.map((c) => c.id)).toEqual([a]);
  });
});

describe('commentsService — reactions', () => {
  beforeEach(() => { store = {}; idCounter = 0; });

  it('reactToEntity writes deterministic id entityKind_entityId_userId', async () => {
    await reactToEntity({ entityKind: 'news', entityId: 'n1', municipalityId: 'm1', userId: 'u1', kind: 'like' });
    expect(store['reactions/news_n1_u1']['kind']).toBe('like');
  });
  it('re-reacting overwrites (one per user)', async () => {
    await reactToEntity({ entityKind: 'news', entityId: 'n1', municipalityId: 'm1', userId: 'u1', kind: 'like' });
    await reactToEntity({ entityKind: 'news', entityId: 'n1', municipalityId: 'm1', userId: 'u1', kind: 'heart' });
    expect(store['reactions/news_n1_u1']['kind']).toBe('heart');
    expect(Object.keys(store).filter((k) => k.startsWith('reactions/')).length).toBe(1);
  });
  it('removeReaction deletes; getMyReaction returns kind or null', async () => {
    await reactToEntity({ entityKind: 'news', entityId: 'n1', municipalityId: 'm1', userId: 'u1', kind: 'heart' });
    expect(await getMyReaction('news', 'n1', 'u1')).toBe('heart');
    await removeReaction('news', 'n1', 'u1');
    expect(await getMyReaction('news', 'n1', 'u1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test → FAIL** (`pnpm --filter @cultuvilla/shared test commentsService`).

- [ ] **Step 3: Implement the service:**

```ts
// packages/shared/src/services/commentsService.ts
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit as fsLimit,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import {
  commentsCollection,
  commentDoc,
  reactionsCollection,
  reactionDoc,
} from '../firebase/refs/client';
import { buildCommentData, type CommentData } from '../models/interaction/CommentDataModel';
import {
  buildReactionData,
  reactionDocId,
  type ReactionKind,
} from '../models/interaction/ReactionDataModel';
import type { EntityKind } from '../models/interaction/EntityKind';

export interface AddCommentInput {
  entityKind: EntityKind;
  entityId: string;
  municipalityId: string;
  authorUserId: string;
  body: string;
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
    }),
  );
  return ref.id;
}

export async function deleteComment(commentId: string): Promise<void> {
  await deleteDoc(commentDoc(getDb(), commentId));
}

export async function getComments(
  entityKind: EntityKind,
  entityId: string,
  options: { limit?: number } = {},
): Promise<(CommentData & { id: string })[]> {
  const constraints = [
    where('entityKind', '==', entityKind),
    where('entityId', '==', entityId),
    orderBy('createdAt', 'asc'),
    ...(options.limit ? [fsLimit(options.limit)] : []),
  ];
  const q = query(commentsCollection(getDb()), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export interface ReactToEntityInput {
  entityKind: EntityKind;
  entityId: string;
  municipalityId: string;
  userId: string;
  kind: ReactionKind;
}

export async function reactToEntity(input: ReactToEntityInput): Promise<void> {
  const ref = reactionDoc(getDb(), reactionDocId(input.entityKind, input.entityId, input.userId));
  await setDoc(
    ref,
    buildReactionData({
      entityKind: input.entityKind,
      entityId: input.entityId,
      municipalityId: input.municipalityId,
      userId: input.userId,
      kind: input.kind,
      createdAt: new Date(),
    }),
  );
}

export async function removeReaction(
  entityKind: EntityKind,
  entityId: string,
  userId: string,
): Promise<void> {
  await deleteDoc(reactionDoc(getDb(), reactionDocId(entityKind, entityId, userId)));
}

export async function getMyReaction(
  entityKind: EntityKind,
  entityId: string,
  userId: string,
): Promise<ReactionKind | null> {
  const snap = await getDoc(reactionDoc(getDb(), reactionDocId(entityKind, entityId, userId)));
  if (!snap.exists()) return null;
  return snap.data().kind;
}
```

- [ ] **Step 4: Run test → PASS.**

- [ ] **Step 5: Commit** (defer if refs still reference deleted news — do A5 first, then one commit).

```bash
git add packages/shared/src/services/commentsService.ts packages/shared/test/services/commentsService.test.ts packages/shared/src/firebase
git commit -m "feat(comments): add commentsService + converters/refs"
```

### Task A5: Delete news comment/reaction/report backend

**Files:** delete `models/news/NewsCommentDataModel.ts`, `NewsReactionDataModel.ts`, `NewsReportDataModel.ts`; update `models/news/index.ts`; delete the six `newsComment*`/`newsReaction*`/`newsReport*` converters; remove the seven functions + their imports from `services/newsService.ts`; delete the news comment/reaction/report tests from `test/services/newsService.test.ts`.

- [ ] **Step 1:** Delete the three model files; edit `models/news/index.ts` to drop those three `export *` lines (keep `NewsPostDataModel`).
- [ ] **Step 2:** Delete the six converter files.
- [ ] **Step 3:** In `services/newsService.ts` remove `reactToPost`, `removeReaction`, `getMyReaction`, `addComment`, `deleteOwnComment`, `getComments`, `reportComment`, their `AddCommentInput`/`ReportCommentInput` interfaces, and now-unused imports (`newsCommentsCollection`, `newsCommentDoc`, `newsReactionDoc`, `newsReportsCollection`, `buildNews{Comment,Reaction,Report}Data`, `reactionDocId`, `NewsReactionKind` if unused). Keep `deleteNewsPost` (the callable that server-side-cascades).
- [ ] **Step 4:** Remove the "Task 5: Reactions" and "Task 6: Comments and Reports" describe blocks and the deleted-function imports from `test/services/newsService.test.ts`.
- [ ] **Step 5:** Verify `NewsReactionKindSchema` / `NewsReactionCounts` in `NewsPostDataModel.ts` — the news **post** still declares `reactionCounts` + `commentCount`, so `NewsReactionCounts` likely stays; remove `NewsReactionKindSchema` only if no remaining reference (grep).
- [ ] **Step 6: Run** `pnpm --filter @cultuvilla/shared typecheck && pnpm --filter @cultuvilla/shared test` → green.
- [ ] **Step 7: Commit**

```bash
git add -A packages/shared
git commit -m "refactor(comments): remove news-specific comment/reaction/report backend"
```

---

## Stage B — Firestore rules & index

### Task B1: Generic rules blocks + validators

**Files:** `firestore.rules`

- [ ] **Step 1:** Add helper + validators near the other `isValid…` functions (after ~line 240):

```
    function isValidEntityKind(v) {
      return v in ['event', 'festivalPoster', 'place', 'barrio', 'organization', 'news'];
    }

    function isValidCommentCreate(d) {
      return d.keys().hasOnly(['entityKind', 'entityId', 'municipalityId', 'authorUserId', 'body', 'createdAt'])
          && d.keys().hasAll(['entityKind', 'entityId', 'municipalityId', 'authorUserId', 'body', 'createdAt'])
          && isValidEntityKind(d.entityKind)
          && isString(d.entityId)
          && isString(d.municipalityId)
          && isString(d.authorUserId)
          && isString(d.body) && d.body.size() > 0 && d.body.size() <= 2000
          && isTimestamp(d.createdAt);
    }

    function isValidReactionWrite(d) {
      return d.keys().hasOnly(['entityKind', 'entityId', 'municipalityId', 'userId', 'kind', 'createdAt'])
          && d.keys().hasAll(['entityKind', 'entityId', 'municipalityId', 'userId', 'kind', 'createdAt'])
          && isValidEntityKind(d.entityKind)
          && isString(d.entityId)
          && isString(d.municipalityId)
          && isString(d.userId)
          && d.kind in ['like', 'heart']
          && isTimestamp(d.createdAt);
    }
```

- [ ] **Step 2:** Add the two match blocks (top-level, alongside the other top-level collections):

```
    match /comments/{commentId} {
      allow read: if true;
      allow create: if isAuthenticated()
                      && isValidCommentCreate(request.resource.data)
                      && request.resource.data.authorUserId == request.auth.uid;
      allow update: if false;
      allow delete: if isOwner(resource.data.authorUserId)
                      || isVillageAdmin(resource.data.municipalityId)
                      || isAppAdmin();
    }

    match /reactions/{reactionId} {
      allow read: if true;
      allow create, update: if isAuthenticated()
                              && isValidReactionWrite(request.resource.data)
                              && request.resource.data.userId == request.auth.uid
                              && reactionId == request.resource.data.entityKind + '_'
                                   + request.resource.data.entityId + '_' + request.auth.uid;
      allow delete: if isOwner(resource.data.userId);
    }
```

- [ ] **Step 3:** Delete the `newsComments`, `newsReactions`, `newsReports` match blocks (old lines 483–513) and the `isValidNewsCommentCreate`, `isValidNewsReactionWrite`, `isValidNewsReportCreate` validators (old lines 193–240). (The `/news/{postId}` block stays untouched — it still guards the news post's own `commentCount`/`reactionCounts`.)
- [ ] **Step 4: Commit** (rules test lands in B3).

```bash
git add firestore.rules
git commit -m "feat(comments): generic comments/reactions rules; drop news-specific blocks"
```

### Task B2: Composite index

**Files:** `firestore.indexes.json`

- [ ] **Step 1:** Add:

```json
    {
      "collectionGroup": "comments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "entityKind", "order": "ASCENDING" },
        { "fieldPath": "entityId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
```

- [ ] **Step 2:** Remove the `newsComments` and `newsReports` index entries (reactions have no index — fetched by doc id).
- [ ] **Step 3: Commit** `chore(comments): add comments composite index; drop news indexes`.

### Task B3: e2e rules test

**Files:** Create `packages/shared/test/e2e/interactionRules.test.ts`; delete the news comment/reaction/report describe blocks from `newsRules.test.ts`.

- [ ] **Step 1: Write the test** (harness copied from `newsRules.test.ts` — `useRulesTestEnv`, `asUser`, `seed`, `seedMember`). Cover:

```ts
describe('firestore.rules — /comments', () => {
  it('anyone (even unauthenticated) can read comments', async () => {
    await seed(getEnv(), async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'comments/c1'), {
        entityKind: 'event', entityId: 'e1', municipalityId: 'm1',
        authorUserId: 'alice', body: 'hi', createdAt: new Date(),
      });
    });
    const anon = getEnv().unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, 'comments/c1')));
  });

  it('a signed-in non-member can create their own comment', async () => {
    const bob = asUser(getEnv(), 'bob'); // no membership seeded
    await assertSucceeds(setDoc(doc(bob, 'comments/c2'), {
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1',
      authorUserId: 'bob', body: 'great', createdAt: new Date(),
    }));
  });

  it('cannot create a comment authored by someone else', async () => {
    const bob = asUser(getEnv(), 'bob');
    await assertFails(setDoc(doc(bob, 'comments/c3'), {
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1',
      authorUserId: 'alice', body: 'spoof', createdAt: new Date(),
    }));
  });

  it('unauthenticated cannot create', async () => {
    const anon = getEnv().unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(anon, 'comments/c4'), {
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1',
      authorUserId: 'ghost', body: 'x', createdAt: new Date(),
    }));
  });

  it('comment is immutable (no update)', async () => {
    await seed(getEnv(), async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'comments/c5'), {
        entityKind: 'event', entityId: 'e1', municipalityId: 'm1',
        authorUserId: 'alice', body: 'orig', createdAt: new Date(),
      });
    });
    const alice = asUser(getEnv(), 'alice');
    await assertFails(updateDoc(doc(alice, 'comments/c5'), { body: 'edited' }));
  });

  it('owner deletes own; village admin deletes any in their village; app admin deletes anywhere; stranger cannot', async () => {
    async function seedComment(id: string) {
      await seed(getEnv(), async (ctx) => {
        await setDoc(doc(ctx.firestore(), `comments/${id}`), {
          entityKind: 'event', entityId: 'e1', municipalityId: 'm1',
          authorUserId: 'alice', body: 'x', createdAt: new Date(),
        });
      });
    }
    await seedComment('d1'); await assertSucceeds(deleteDoc(doc(asUser(getEnv(), 'alice'), 'comments/d1')));
    await seedMember('m1', 'mod', { role: 'admin' });
    await seedComment('d2'); await assertSucceeds(deleteDoc(doc(asUser(getEnv(), 'mod'), 'comments/d2')));
    await seed(getEnv(), async (ctx) => { await setDoc(doc(ctx.firestore(), 'admins/root'), { createdAt: new Date() }); });
    await seedComment('d3'); await assertSucceeds(deleteDoc(doc(asUser(getEnv(), 'root'), 'comments/d3')));
    await seedComment('d4'); await assertFails(deleteDoc(doc(asUser(getEnv(), 'bob'), 'comments/d4')));
  });
});

describe('firestore.rules — /reactions', () => {
  it('member creates reaction at entityKind_entityId_uid; wrong id fails', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(setDoc(doc(alice, 'reactions/event_e1_alice'), {
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', userId: 'alice', kind: 'like', createdAt: new Date(),
    }));
    await assertFails(setDoc(doc(alice, 'reactions/event_e1_bob'), {
      entityKind: 'event', entityId: 'e1', municipalityId: 'm1', userId: 'bob', kind: 'like', createdAt: new Date(),
    }));
  });
});
```

Confirm the `admins/{uid}` seed shape and `asUser`/`unauthenticatedContext` helpers against `newsRules.test.ts` / `helpers/roles.ts` before finalizing.

- [ ] **Step 2: Run** `pnpm test:rules` → PASS (both the new file and the trimmed `newsRules.test.ts`).
- [ ] **Step 3: Commit** `test(comments): e2e rules for comments/reactions`.

---

## Stage C — Denormalized counts (heavy, isolated stage)

> This stage edits five entity models + factories, five create-validators, the entity update-mutation guards, adds a routing trigger, and backfills dev. It is deliberately separate so it can be reviewed and reverted on its own. `news` is already done and is **not** modified here except that the generic trigger now maintains its counts (delete its old triggers).

### Task C1: Add count fields to the five entity models

**Files:** `EventDataModel.ts`, `OrganizationDataModel.ts`, `FestivalPosterDataModel.ts`, the place model, the barrio model. **Test:** extend each model's existing builder test (or add `interaction-counts.test.ts`).

- [ ] **Step 1: Write/extend a failing test** asserting each `buildXData(...)` returns `commentCount: 0` and `reactionCounts: { like: 0, heart: 0 }`. Example for event:

```ts
import { buildEventData } from '../../src/models/event/EventDataModel';
it('event starts with zero interaction counts', () => {
  const e = buildEventData({ /* existing minimal valid input */ });
  expect(e.commentCount).toBe(0);
  expect(e.reactionCounts).toEqual({ like: 0, heart: 0 });
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Edit each schema** — add, next to the existing counters (e.g. event's `confirmedCount`/`totalCount`):

```ts
import { ReactionCountsSchema } from '../interaction/ReactionDataModel';
// …in the schema object:
  commentCount: z.number().int(),
  reactionCounts: ReactionCountsSchema,
```

and each factory's returned object:

```ts
    commentCount: 0,
    reactionCounts: { like: 0, heart: 0 },
```

Fields are **required** (no `.default()`) — old dev docs are handled by the C4 backfill, matching the repo's "no retrocompat shim" rule. For place/barrio, apply the same edit to their builders (whether direct or proposal-based).

- [ ] **Step 4: Run → PASS**, then `pnpm --filter @cultuvilla/shared typecheck` (fix any seed/fixture that hand-builds these docs).
- [ ] **Step 5: Commit** `feat(comments): denormalized commentCount + reactionCounts on 5 entities`.

### Task C2: entityKind-routing count trigger

**Files:** Create `functions/src/interaction/syncEntityInteractionCounts.ts`; edit `functions/src/index.ts`; delete `functions/src/news/syncNewsCommentCount.ts` + `syncNewsReactionCounts.ts`.

- [ ] **Step 1: Implement** (routes to the correct parent, including nested place/barrio; swallows NOT_FOUND like the news triggers):

```ts
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue, type DocumentReference } from 'firebase-admin/firestore';

const db = getFirestore();

function parentRef(entityKind: string, entityId: string, municipalityId: string): DocumentReference | null {
  switch (entityKind) {
    case 'event':          return db.collection('events').doc(entityId);
    case 'organization':   return db.collection('organizations').doc(entityId);
    case 'festivalPoster': return db.collection('festivalPosters').doc(entityId);
    case 'news':           return db.collection('news').doc(entityId);
    case 'place':          return db.collection('municipalities').doc(municipalityId).collection('places').doc(entityId);
    case 'barrio':         return db.collection('municipalities').doc(municipalityId).collection('barrios').doc(entityId);
    default:               return null;
  }
}

function isNotFound(err: unknown): boolean {
  const code = (err as { code?: number | string } | null)?.code;
  return code === 5 || code === 'NOT_FOUND' || code === 'not-found';
}

export const syncEntityCommentCount = onDocumentWritten(
  { document: 'comments/{commentId}', region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() ?? null;
    const after = event.data?.after.data() ?? null;
    if (!before && !after) return;
    let delta = 0;
    if (!before && after) delta = 1;
    else if (before && !after) delta = -1;
    if (delta === 0) return; // updates are forbidden by rules, so this only fires on create/delete
    const d = after ?? before!;
    const ref = parentRef(d['entityKind'] as string, d['entityId'] as string, d['municipalityId'] as string);
    if (!ref) {
      logger.warn('unknown entityKind for comment count', { handler: 'syncEntityCommentCount', entityKind: d['entityKind'] });
      return;
    }
    try {
      await ref.update({ commentCount: FieldValue.increment(delta) });
    } catch (err) {
      if (isNotFound(err)) return;
      throw err;
    }
    logger.info('comment count updated', { handler: 'syncEntityCommentCount', entityKind: d['entityKind'], entityId: d['entityId'], delta });
  },
);

export const syncEntityReactionCounts = onDocumentWritten(
  { document: 'reactions/{reactionId}', region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() ?? null;
    const after = event.data?.after.data() ?? null;
    if (!before && !after) return;
    const d = after ?? before!;
    const ref = parentRef(d['entityKind'] as string, d['entityId'] as string, d['municipalityId'] as string);
    if (!ref) {
      logger.warn('unknown entityKind for reaction count', { handler: 'syncEntityReactionCounts', entityKind: d['entityKind'] });
      return;
    }
    try {
      if (!before && after) {
        await ref.update({ [`reactionCounts.${after['kind'] as string}`]: FieldValue.increment(1) });
      } else if (before && !after) {
        await ref.update({ [`reactionCounts.${before['kind'] as string}`]: FieldValue.increment(-1) });
      } else if (before && after) {
        const oldKind = before['kind'] as string;
        const newKind = after['kind'] as string;
        if (oldKind === newKind) return;
        await ref.update({
          [`reactionCounts.${oldKind}`]: FieldValue.increment(-1),
          [`reactionCounts.${newKind}`]: FieldValue.increment(1),
        });
      }
    } catch (err) {
      if (isNotFound(err)) return;
      throw err;
    }
  },
);
```

- [ ] **Step 2:** In `functions/src/index.ts` replace the two `syncNews*` exports with:

```ts
export { syncEntityCommentCount, syncEntityReactionCounts } from './interaction/syncEntityInteractionCounts';
```

- [ ] **Step 3:** Delete `functions/src/news/syncNewsCommentCount.ts` and `syncNewsReactionCounts.ts`.
- [ ] **Step 4: Commit** `feat(comments): entityKind-routing count triggers; drop news triggers`.

### Task C3: Update entity create-validators + block count mutation

**Files:** `firestore.rules`

- [ ] **Step 1:** For each of `isValidEventCreate` (:391), `isValidOrganizationCreate` (:278), `isValidFestivalPosterProposalCreate` (:338), `isValidPlaceProposalCreate` (:317), `isValidBarrioProposalCreate` (:372): add `'commentCount'` and `'reactionCounts'` to both the `hasOnly([...])` and `hasAll([...])` key arrays, and append the checks:

```
          && d.commentCount == 0
          && d.reactionCounts.like == 0
          && d.reactionCounts.heart == 0
```

(Read each validator to place the keys correctly; the exact current key list lives in the file.)

- [ ] **Step 2:** In each entity's `match` block (events :721, organizations :675, festivalPosters :790, places :580, barrios :560), ensure the `update` rule **blocks client mutation of the counters** — mirror the news pattern:

```
        && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['commentCount', 'reactionCounts'])
```

Add this conjunct to whatever `allow update` condition each block already has (if a block has no client update path, no change needed).

- [ ] **Step 3: Extend `interactionRules.test.ts`** (or the relevant per-entity rules test) with: "creating an event with `commentCount: 5` fails" and "a client cannot bump `commentCount` on an existing event". Run `pnpm test:rules` → PASS.
- [ ] **Step 4: Commit** `feat(comments): guard denormalized counts in entity create/update rules`.

### Task C4: Dev backfill

**Files:** Create `scripts/backfill-entity-comment-counts.mjs` (mirror `scripts/backfill-municipality-namelower.mjs`).

- [ ] **Step 1: Write the script** — project-id guard (`villa-events` only), iterate `events`, `organizations`, `festivalPosters`, and every `municipalities/*/places` + `municipalities/*/barrios`; patch only docs missing `commentCount`/`reactionCounts`, setting `commentCount: 0`, `reactionCounts: { like: 0, heart: 0 }`. Idempotent. (`news` already has the fields — skip or no-op.) Use the `firebase-admin-dev` credentials pattern.
- [ ] **Step 2: Run it** against dev, then `pnpm check:dev-conformance` → all collections conform.
- [ ] **Step 3: Commit** `chore(comments): backfill dev entity docs with comment/reaction counts`.

### Task C5: Trigger unit test

**Files:** Create `functions/src/__tests__/interaction/syncEntityInteractionCounts.test.ts` (mirror the existing news trigger tests under `functions/src/__tests__/`).

- [ ] **Step 1: Write tests** driving `syncEntityCommentCount` / `syncEntityReactionCounts` for: comment create → parent `commentCount +1`; comment delete → `-1`; reaction create/delete → `reactionCounts.<kind> ±1`; reaction kind change → `-1`/`+1`; `place`/`barrio` route to the nested municipality path; unknown kind → no-op + warn; NOT_FOUND parent → swallowed. Use the functions test harness (emulator-backed).
- [ ] **Step 2: Run** `pnpm test:functions` → PASS.
- [ ] **Step 3: Commit** `test(comments): entity interaction count triggers`.

---

## Stage D — Mobile UI + i18n

### Task D1: i18n strings

**Files:** `packages/i18n/messages/es.json`

- [ ] **Step 1:** Add a `comments` namespace:

```json
"comments": {
  "sectionTitle": "Comentarios",
  "empty": "Sé el primero en comentar",
  "placeholder": "Escribe un comentario…",
  "send": "Enviar",
  "signInToComment": "Inicia sesión para comentar",
  "delete": "Eliminar",
  "deleteConfirm": "¿Eliminar este comentario?",
  "reactions": { "like": "Me gusta", "heart": "Me encanta" },
  "countLabel": "{count, plural, =0 {Sin comentarios} one {# comentario} other {# comentarios}}"
}
```

- [ ] **Step 2: Commit** `feat(comments): i18n strings`.

### Task D2: `<ReactionBar>` + `<EntityComments>` components

**Files:** Create `apps/mobile/components/feature/ReactionBar.tsx`, `EntityComments.tsx`. **Test:** `apps/mobile/__tests__/EntityComments.test.tsx` (jest + `@testing-library/react-native`) if feasible; otherwise document manual verification per the mobile-web-compat gotchas.

**Interfaces — Consumes:** `commentsService.*`, `useAuth()`, `useT()`, `formatRelativeTime`, `EntityKind`, primitives. **Props:**

```ts
type EntityCommentsProps = {
  entityKind: EntityKind;
  entityId: string;
  municipalityId: string;
  /** From the already-fetched entity doc; drives the reaction-bar counts. */
  initialReactionCounts: { like: number; heart: number };
  /** True when the current user administers this entity's village (owner delete is by-author). */
  canModerate?: boolean;
};
```

- [ ] **Step 1:** Build `<ReactionBar>` — two `Pressable` pills (like/heart) with `Ionicons` (`heart-outline`/`heart`, `thumbs-up-outline`/`thumbs-up`) sized `iconSizes.sm`, showing the count; tapping calls `reactToEntity`/`removeReaction` and updates local optimistic state; the user's current reaction (`getMyReaction`) is highlighted. Signed-out users tapping route to the register gate (mirror `useRegisterGate` usage in `event/[eventId].tsx`).
- [ ] **Step 2:** Build `<EntityComments>` — a `VStack`: `DetailSectionHeading` (`comments.sectionTitle`), `<ReactionBar>`, the comment list (each row: author display name, `formatRelativeTime(createdAt)`, body, and a delete icon shown when `comment.authorUserId === user?.uid || canModerate`), and the compose input (`Input` + send `Button`) for signed-in users or a `comments.signInToComment` prompt otherwise. Fetch comments via `getComments(entityKind, entityId)` in `useEffect`; append optimistically on send; call `deleteComment` on delete. Use `Alert`-with-`Platform.OS` branching for the delete confirm (per `project_alert_on_web` — `Alert.alert` is a no-op on web). Put any bottom-anchored styles on `style`, not `className` (NativeWind + Animated gotcha), and pad by `insets.bottom` if the compose bar anchors to the bottom.
- [ ] **Step 3:** Resolve comment author names via `getPersonByUserId` (as `event/[eventId].tsx` does) or a lightweight `LiveOwnerChip`-style lookup; avoid N+1 by memoizing per author within the list.
- [ ] **Step 4:** `pnpm app:typecheck` → green. Run the jest test if written.
- [ ] **Step 5: Commit** `feat(comments): EntityComments + ReactionBar mobile components`.

### Task D3: Wire into the six detail screens

**Files:** the six `EntityDetailScaffold` consumers.

- [ ] **Step 1:** In each screen, add as the **last child** inside the scaffold's children, once the entity has loaded:

```tsx
<EntityComments
  entityKind="event"                    // the screen's kind
  entityId={event.id}
  municipalityId={event.municipalityId}
  initialReactionCounts={event.reactionCounts}
  canModerate={/* village-admin check, e.g. useEntityCapabilities(event.municipalityId).canManage */}
/>
```

Use each screen's already-loaded entity object (`event`, `post`, `org`, `place`, `barrio`, `poster`) and its `municipalityId`. For screens whose `scrollContentClassName` clears a FAB (`event/[eventId].tsx` uses `pb-24`), keep it. Wire `canModerate` from `useEntityCapabilities` (mobile) which already takes a `municipalityId`.

- [ ] **Step 2:** `pnpm app:typecheck` → green.
- [ ] **Step 3: Commit** `feat(comments): show comments on all six entity detail screens`.

### Task D4: Card comment-count badge

**Files:** `apps/mobile/components/feature/FeedCard.tsx` (+ `EventCard.tsx`, `NewsCard.tsx`, and the org/place/barrio/festival card wrappers).

- [ ] **Step 1:** Add an optional `commentCount?: number` to `FeedCardProps`; when `> 0`, render a small `💬 {count}` element in the existing bottom `metaRight` scrim row (do not overload the top-left `badge` pill, which carries status like "En curso").
- [ ] **Step 2:** In each card wrapper, pass `commentCount={entity.commentCount}` from the feed doc.
- [ ] **Step 3:** `pnpm app:typecheck` → green; manual check per mobile-web-compat.
- [ ] **Step 4: Commit** `feat(comments): comment-count badge on entity cards`.

---

## Stage E — Docs & final gate

- [ ] **Task E1:** Update `packages/shared/src/services/_services-map.md` (add `commentsService`; remove the deleted news functions), `docs/architecture/denormalized-read-models.md` (add the `commentCount`/`reactionCounts` read model + the routing trigger), and `CHANGELOG.md` `[Unreleased]`. Commit `docs(comments): services map, denormalized model, changelog`.
- [ ] **Task E2:** Run the full gate: `pnpm check` (lint + typecheck + test + build) and `pnpm app:typecheck`. Fix anything red. Then `pnpm check:dev-conformance` once more.
- [ ] **Task E3:** Rebase onto latest `develop`, re-run `pnpm check`, open the PR targeting `develop`.

---

## Out of scope (rejected / deferred)

- **Reply threads / nested comments** — flat only.
- **Soft-hide (`hidden`) & user-reporting (`reports`)** — replaced by hard delete gated by rules; revisit if abuse appears.
- **Owner/author notification on new comment** — trigger pattern exists (`users/{uid}/notifications`) but deferred.
- **Data migration of existing news comments** — none exist; old code is deleted, not migrated.
- **Deep-linking to a specific comment** and **edit-a-comment** — future.
