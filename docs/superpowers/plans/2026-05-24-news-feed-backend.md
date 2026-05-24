# News Feed (Noticias) — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the data layer for the news feed feature: models, client service, Cloud Function callables and triggers, Firestore rules, indexes, storage rules, and i18n. No UI in this plan.

**Architecture:** Top-level Firestore collections (`news`, `newsComments`, `newsReactions`, `newsReports`) scoped by `municipalityId`, per AGENTS.md §3. Trust to bypass moderation lives on the existing `municipalities/{id}/members/{uid}` membership doc as `trustedNewsAuthor: boolean`. Cross-user writes (moderation, deletion, trust grants, report resolution) live in Cloud Function callables; client-facing writes go through `newsService`. Reactions and comment counts denormalized on the post via triggers.

**Tech Stack:** TypeScript (strict), Firebase v9 modular SDK, Firebase Functions v2, vitest, `@firebase/rules-unit-testing`, Firestore emulator.

**Spec:** [docs/superpowers/specs/2026-05-24-news-feed-design.md](../specs/2026-05-24-news-feed-design.md)

**Branch:** `feat/news-feed` (worktree at `.claude/worktrees/news-feed/`)

---

## File structure

### New files
- `packages/shared/src/models/news/NewsPostDataModel.ts`
- `packages/shared/src/models/news/NewsCommentDataModel.ts`
- `packages/shared/src/models/news/NewsReactionDataModel.ts`
- `packages/shared/src/models/news/NewsReportDataModel.ts`
- `packages/shared/src/models/news/index.ts`
- `packages/shared/src/services/newsService.ts`
- `packages/shared/test/services/newsService.test.ts`
- `packages/shared/test/e2e/newsRules.test.ts`
- `functions/src/news/moderateNewsPost.ts`
- `functions/src/news/deleteNewsPost.ts`
- `functions/src/news/setTrustedNewsAuthor.ts`
- `functions/src/news/resolveNewsReport.ts`
- `functions/src/news/syncNewsReactionCounts.ts`
- `functions/src/news/syncNewsCommentCount.ts`
- `functions/test/news/moderateNewsPost.test.ts`
- `functions/test/news/deleteNewsPost.test.ts`
- `functions/test/news/setTrustedNewsAuthor.test.ts`
- `functions/test/news/resolveNewsReport.test.ts`
- `functions/test/news/syncNewsCounters.test.ts`
- `packages/i18n/messages/news/es.json` (+ peer locales if any)

### Modified files
- `packages/shared/src/models/index.ts` — re-export news models
- `packages/shared/src/models/municipality/VillageMemberDataModel.ts` — add `trustedNewsAuthor`
- `packages/shared/src/services/index.ts` — re-export `newsService`
- `packages/shared/src/services/_services-map.md` — add news row (and fix stale rows touched in passing)
- `firestore.rules` — add news, newsComments, newsReactions, newsReports blocks; tighten members block
- `firestore.indexes.json` — 4 new composite indexes
- `storage.rules` — news image paths
- `functions/src/index.ts` — export new functions

---

## Task 1 — Add `trustedNewsAuthor` field to VillageMemberData

**Files:**
- Modify: `packages/shared/src/models/municipality/VillageMemberDataModel.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/shared/test/services/membershipProfileService.test.ts` (or create `packages/shared/test/models/VillageMemberDataModel.test.ts` if no model test exists) — pick whichever matches existing test layout. Test that `buildVillageMemberData()` defaults `trustedNewsAuthor` to `false` and accepts it via input.

```ts
import { describe, it, expect } from 'vitest';
import { buildVillageMemberData } from '@cultuvilla/shared/models/municipality/VillageMemberDataModel';

describe('buildVillageMemberData', () => {
  it('defaults trustedNewsAuthor to false', () => {
    const m = buildVillageMemberData();
    expect(m.trustedNewsAuthor).toBe(false);
  });

  it('passes trustedNewsAuthor through', () => {
    const m = buildVillageMemberData({ trustedNewsAuthor: true });
    expect(m.trustedNewsAuthor).toBe(true);
  });
});
```

- [ ] **Step 2: Run, confirm RED**

Run: `pnpm shared:test -- VillageMemberDataModel` (or the file you put the tests in).
Expected: FAIL — `trustedNewsAuthor` does not exist.

- [ ] **Step 3: Implement**

Replace the contents of `packages/shared/src/models/municipality/VillageMemberDataModel.ts` with:

```ts
import type { ProfileAnswers } from './CensoTypes';

export type VillageMemberRole = 'admin' | 'user';

/**
 * A member of the community living on a municipality.
 * Stored at /municipalities/{municipalityId}/members/{userId}.
 */
export interface VillageMemberData {
  role: VillageMemberRole;
  joinedAt: Date;
  profileAnswers: ProfileAnswers;
  profileCompletedAt: Date | null;
  trustedNewsAuthor: boolean;
}

export interface VillageMemberDataInput {
  role?: VillageMemberRole;
  joinedAt?: Date;
  profileAnswers?: ProfileAnswers;
  profileCompletedAt?: Date | null;
  trustedNewsAuthor?: boolean;
}

export function buildVillageMemberData(input: VillageMemberDataInput = {}): VillageMemberData {
  return {
    role: input.role ?? 'user',
    joinedAt: input.joinedAt ?? new Date(),
    profileAnswers: input.profileAnswers ?? {},
    profileCompletedAt: input.profileCompletedAt ?? null,
    trustedNewsAuthor: input.trustedNewsAuthor ?? false,
  };
}
```

- [ ] **Step 4: Run, confirm GREEN**

Run: `pnpm shared:test`
Expected: ALL pass (the new tests + the existing 206).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/municipality/VillageMemberDataModel.ts packages/shared/test/
git commit -m "feat(shared): add trustedNewsAuthor field to VillageMemberData"
```

---

## Task 2 — NewsPost data model

**Files:**
- Create: `packages/shared/src/models/news/NewsPostDataModel.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/models/NewsPostDataModel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  buildNewsPostData,
  type NewsPostCategory,
  NEWS_POST_CATEGORIES,
} from '@cultuvilla/shared/models/news/NewsPostDataModel';

describe('buildNewsPostData', () => {
  it('produces a pending post with zeroed counters by default', () => {
    const now = new Date();
    const p = buildNewsPostData({
      municipalityId: 'm1',
      authorUserId: 'u1',
      title: 'Fiesta',
      body: 'Detalles',
      category: 'fiesta',
      submittedAt: now,
      createdBy: 'u1',
      updatedAt: now,
    });
    expect(p.status).toBe('pending');
    expect(p.publishedAt).toBeNull();
    expect(p.authorOrgId).toBeNull();
    expect(p.rejectionReason).toBeNull();
    expect(p.images).toEqual([]);
    expect(p.reactionCounts).toEqual({ like: 0, heart: 0 });
    expect(p.commentCount).toBe(0);
  });

  it('exposes the canonical category list', () => {
    const expected: NewsPostCategory[] = ['fiesta', 'tradicion', 'gastronomia', 'historia', 'otro'];
    expect(NEWS_POST_CATEGORIES).toEqual(expected);
  });
});
```

- [ ] **Step 2: Run, confirm RED**

Run: `pnpm shared:test -- NewsPostDataModel`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `packages/shared/src/models/news/NewsPostDataModel.ts`:

```ts
export const NEWS_POST_CATEGORIES = [
  'fiesta',
  'tradicion',
  'gastronomia',
  'historia',
  'otro',
] as const;
export type NewsPostCategory = typeof NEWS_POST_CATEGORIES[number];

export type NewsPostStatus = 'pending' | 'approved' | 'rejected';

export type NewsReactionKind = 'like' | 'heart';

export interface NewsPostImage {
  storagePath: string;
  width: number;
  height: number;
}

export interface NewsReactionCounts {
  like: number;
  heart: number;
}

/**
 * A village news post. Stored at /news/{postId} (top-level).
 */
export interface NewsPostData {
  municipalityId: string;
  authorUserId: string;
  authorOrgId: string | null;
  title: string;
  body: string;
  category: NewsPostCategory;
  images: NewsPostImage[];
  status: NewsPostStatus;
  rejectionReason: string | null;
  submittedAt: Date;
  publishedAt: Date | null;
  createdBy: string;
  updatedAt: Date;
  reactionCounts: NewsReactionCounts;
  commentCount: number;
}

export interface NewsPostDataInput {
  municipalityId: string;
  authorUserId: string;
  authorOrgId?: string | null;
  title: string;
  body: string;
  category: NewsPostCategory;
  images?: NewsPostImage[];
  status?: NewsPostStatus;
  rejectionReason?: string | null;
  submittedAt: Date;
  publishedAt?: Date | null;
  createdBy: string;
  updatedAt: Date;
  reactionCounts?: NewsReactionCounts;
  commentCount?: number;
}

export function buildNewsPostData(input: NewsPostDataInput): NewsPostData {
  return {
    municipalityId: input.municipalityId,
    authorUserId: input.authorUserId,
    authorOrgId: input.authorOrgId ?? null,
    title: input.title,
    body: input.body,
    category: input.category,
    images: input.images ?? [],
    status: input.status ?? 'pending',
    rejectionReason: input.rejectionReason ?? null,
    submittedAt: input.submittedAt,
    publishedAt: input.publishedAt ?? null,
    createdBy: input.createdBy,
    updatedAt: input.updatedAt,
    reactionCounts: input.reactionCounts ?? { like: 0, heart: 0 },
    commentCount: input.commentCount ?? 0,
  };
}
```

- [ ] **Step 4: Run, confirm GREEN**

Run: `pnpm shared:test -- NewsPostDataModel`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/news/NewsPostDataModel.ts packages/shared/test/models/NewsPostDataModel.test.ts
git commit -m "feat(shared): add NewsPostData model"
```

---

## Task 3 — NewsComment, NewsReaction, NewsReport models

**Files:**
- Create: `packages/shared/src/models/news/NewsCommentDataModel.ts`
- Create: `packages/shared/src/models/news/NewsReactionDataModel.ts`
- Create: `packages/shared/src/models/news/NewsReportDataModel.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/shared/test/models/NewsAuxiliaryModels.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildNewsCommentData } from '@cultuvilla/shared/models/news/NewsCommentDataModel';
import { buildNewsReactionData, reactionDocId } from '@cultuvilla/shared/models/news/NewsReactionDataModel';
import { buildNewsReportData } from '@cultuvilla/shared/models/news/NewsReportDataModel';

describe('NewsCommentData', () => {
  it('defaults hidden=false', () => {
    const c = buildNewsCommentData({
      postId: 'p1', municipalityId: 'm1', authorUserId: 'u1', body: 'hola', createdAt: new Date(),
    });
    expect(c.hidden).toBe(false);
  });
});

describe('NewsReactionData', () => {
  it('uses deterministic doc id postId_userId', () => {
    expect(reactionDocId('p1', 'u1')).toBe('p1_u1');
  });
  it('builds with required fields', () => {
    const r = buildNewsReactionData({
      postId: 'p1', municipalityId: 'm1', userId: 'u1', kind: 'like', createdAt: new Date(),
    });
    expect(r).toMatchObject({ postId: 'p1', userId: 'u1', kind: 'like' });
  });
});

describe('NewsReportData', () => {
  it('defaults status open and resolved fields null', () => {
    const r = buildNewsReportData({
      targetType: 'comment',
      targetId: 'c1', postId: 'p1', municipalityId: 'm1',
      reporterUserId: 'u1', reason: 'spam', createdAt: new Date(),
    });
    expect(r.status).toBe('open');
    expect(r.resolvedBy).toBeNull();
    expect(r.resolvedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm RED**

Run: `pnpm shared:test -- NewsAuxiliaryModels`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

Create `packages/shared/src/models/news/NewsCommentDataModel.ts`:

```ts
export interface NewsCommentData {
  postId: string;
  municipalityId: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
  hidden: boolean;
}

export interface NewsCommentDataInput {
  postId: string;
  municipalityId: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
  hidden?: boolean;
}

export function buildNewsCommentData(input: NewsCommentDataInput): NewsCommentData {
  return {
    postId: input.postId,
    municipalityId: input.municipalityId,
    authorUserId: input.authorUserId,
    body: input.body,
    createdAt: input.createdAt,
    hidden: input.hidden ?? false,
  };
}
```

Create `packages/shared/src/models/news/NewsReactionDataModel.ts`:

```ts
import type { NewsReactionKind } from './NewsPostDataModel';

export interface NewsReactionData {
  postId: string;
  municipalityId: string;
  userId: string;
  kind: NewsReactionKind;
  createdAt: Date;
}

export function reactionDocId(postId: string, userId: string): string {
  return `${postId}_${userId}`;
}

export function buildNewsReactionData(input: NewsReactionData): NewsReactionData {
  return { ...input };
}
```

Create `packages/shared/src/models/news/NewsReportDataModel.ts`:

```ts
export type NewsReportTargetType = 'comment';
export type NewsReportStatus = 'open' | 'dismissed' | 'actioned';

export interface NewsReportData {
  targetType: NewsReportTargetType;
  targetId: string;
  postId: string;
  municipalityId: string;
  reporterUserId: string;
  reason: string;
  createdAt: Date;
  status: NewsReportStatus;
  resolvedBy: string | null;
  resolvedAt: Date | null;
}

export interface NewsReportDataInput {
  targetType: NewsReportTargetType;
  targetId: string;
  postId: string;
  municipalityId: string;
  reporterUserId: string;
  reason: string;
  createdAt: Date;
  status?: NewsReportStatus;
  resolvedBy?: string | null;
  resolvedAt?: Date | null;
}

export function buildNewsReportData(input: NewsReportDataInput): NewsReportData {
  return {
    targetType: input.targetType,
    targetId: input.targetId,
    postId: input.postId,
    municipalityId: input.municipalityId,
    reporterUserId: input.reporterUserId,
    reason: input.reason,
    createdAt: input.createdAt,
    status: input.status ?? 'open',
    resolvedBy: input.resolvedBy ?? null,
    resolvedAt: input.resolvedAt ?? null,
  };
}
```

- [ ] **Step 4: Run, confirm GREEN**

Run: `pnpm shared:test -- NewsAuxiliaryModels`
Expected: PASS.

- [ ] **Step 5: Re-export from news models index**

Create `packages/shared/src/models/news/index.ts`:

```ts
export * from './NewsPostDataModel';
export * from './NewsCommentDataModel';
export * from './NewsReactionDataModel';
export * from './NewsReportDataModel';
```

Then add `export * from './news';` to `packages/shared/src/models/index.ts` (in the alphabetical order matching the existing exports).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/models/news/ packages/shared/src/models/index.ts packages/shared/test/models/NewsAuxiliaryModels.test.ts
git commit -m "feat(shared): add news comment/reaction/report models"
```

---

## Task 4 — newsService: create, get, list, update

**Files:**
- Create: `packages/shared/src/services/newsService.ts`
- Create: `packages/shared/test/services/newsService.test.ts`

Follow the pattern in `packages/shared/src/services/eventService.ts` (top-level collection, `mapXDoc` helper, `serverTimestamp()` for time fields). Use the existing fake-Firestore pattern in `packages/shared/test/services/registrationService.test.ts` for the test setup.

- [ ] **Step 1: Write failing tests for createNewsPost / getNewsPost / getNewsPostsByMunicipality / updateNewsPost**

In `packages/shared/test/services/newsService.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'; // or whatever the existing pattern is
// ... follow registrationService.test.ts setup. Cases:
//
// 1. createNewsPost writes a doc with status='pending', publishedAt=null,
//    reactionCounts={like:0,heart:0}, commentCount=0,
//    authorUserId from input, authorOrgId null when not provided.
// 2. getNewsPost returns the mapped doc or null.
// 3. getNewsPostsByMunicipality returns approved-only when status filter is given,
//    sorted by publishedAt desc.
// 4. updateNewsPost only touches title/body/category/images; it must throw
//    if the patch contains status, publishedAt, authorUserId, or municipalityId.
```

(Use the existing testing harness — match `registrationService.test.ts`.)

- [ ] **Step 2: Run, confirm RED**

Run: `pnpm shared:test -- newsService`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement newsService skeleton**

Create `packages/shared/src/services/newsService.ts`:

```ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit as fsLimit,
  startAfter,
  serverTimestamp,
  Timestamp,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import {
  type NewsPostData,
  type NewsPostCategory,
  type NewsPostImage,
  type NewsPostStatus,
  type NewsReactionKind,
} from '../models/news/NewsPostDataModel';
import { reactionDocId } from '../models/news/NewsReactionDataModel';

// ────── collections ──────
function newsCol() { return collection(getDb(), 'news'); }
function commentsCol() { return collection(getDb(), 'newsComments'); }
function reactionsCol() { return collection(getDb(), 'newsReactions'); }
function reportsCol() { return collection(getDb(), 'newsReports'); }

// ────── doc mappers ──────
export function mapNewsPostDoc(
  d: { id: string; data: () => Record<string, unknown> }
): NewsPostData & { id: string } {
  const data = d.data();
  const publishedAtRaw = data['publishedAt'];
  return {
    id: d.id,
    municipalityId: data['municipalityId'] as string,
    authorUserId: data['authorUserId'] as string,
    authorOrgId: (data['authorOrgId'] as string | null) ?? null,
    title: data['title'] as string,
    body: data['body'] as string,
    category: data['category'] as NewsPostCategory,
    images: ((data['images'] as NewsPostImage[]) ?? []),
    status: data['status'] as NewsPostStatus,
    rejectionReason: (data['rejectionReason'] as string | null) ?? null,
    submittedAt: (data['submittedAt'] as Timestamp).toDate(),
    publishedAt: publishedAtRaw ? (publishedAtRaw as Timestamp).toDate() : null,
    createdBy: data['createdBy'] as string,
    updatedAt: (data['updatedAt'] as Timestamp).toDate(),
    reactionCounts: (data['reactionCounts'] as { like: number; heart: number }) ?? { like: 0, heart: 0 },
    commentCount: (data['commentCount'] as number) ?? 0,
  };
}

// ────── input types ──────
export interface CreateNewsPostInput {
  municipalityId: string;
  authorUserId: string;
  authorOrgId?: string | null;
  title: string;
  body: string;
  category: NewsPostCategory;
  images?: NewsPostImage[];
}

export type UpdateNewsPostInput = Partial<
  Pick<NewsPostData, 'title' | 'body' | 'category' | 'images'>
>;

const FORBIDDEN_UPDATE_KEYS: ReadonlySet<keyof NewsPostData> = new Set([
  'status', 'publishedAt', 'authorUserId', 'municipalityId',
  'submittedAt', 'createdBy', 'reactionCounts', 'commentCount',
]);

// ────── post CRUD ──────
export async function createNewsPost(input: CreateNewsPostInput): Promise<string> {
  const ref = doc(newsCol());
  await setDoc(ref, {
    municipalityId: input.municipalityId,
    authorUserId: input.authorUserId,
    authorOrgId: input.authorOrgId ?? null,
    title: input.title,
    body: input.body,
    category: input.category,
    images: input.images ?? [],
    status: 'pending' as NewsPostStatus,
    rejectionReason: null,
    submittedAt: serverTimestamp(),
    publishedAt: null,
    createdBy: input.authorUserId,
    updatedAt: serverTimestamp(),
    reactionCounts: { like: 0, heart: 0 },
    commentCount: 0,
  });
  return ref.id;
}

export async function getNewsPost(id: string): Promise<(NewsPostData & { id: string }) | null> {
  const snap = await getDoc(doc(newsCol(), id));
  if (!snap.exists()) return null;
  return mapNewsPostDoc(snap as Parameters<typeof mapNewsPostDoc>[0]);
}

export async function getNewsPostsByMunicipality(
  municipalityId: string,
  options: { status?: NewsPostStatus; limit?: number; afterPublishedAt?: Date } = {}
): Promise<(NewsPostData & { id: string })[]> {
  const constraints: Parameters<typeof query>[1][] = [
    where('municipalityId', '==', municipalityId),
  ];
  if (options.status) constraints.push(where('status', '==', options.status));
  constraints.push(orderBy('publishedAt', 'desc'));
  if (options.afterPublishedAt) constraints.push(startAfter(Timestamp.fromDate(options.afterPublishedAt)));
  if (options.limit) constraints.push(fsLimit(options.limit));
  const q = query(newsCol(), ...(constraints as Parameters<typeof query> extends [unknown, ...infer R] ? R : never));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapNewsPostDoc(d as Parameters<typeof mapNewsPostDoc>[0]));
}

export async function updateNewsPost(id: string, patch: UpdateNewsPostInput): Promise<void> {
  for (const k of Object.keys(patch)) {
    if (FORBIDDEN_UPDATE_KEYS.has(k as keyof NewsPostData)) {
      throw new Error(`updateNewsPost: cannot modify field "${k}" from the client`);
    }
  }
  await updateDoc(doc(newsCol(), id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}
```

> Note on the typing of `constraints`: copy the exact pattern from `eventService.ts` if the typing dance above is awkward — that file's `query(...constraints)` style is the proven approach.

- [ ] **Step 4: Run, confirm GREEN**

Run: `pnpm shared:test -- newsService`
Expected: PASS for the four cases.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/services/newsService.ts packages/shared/test/services/newsService.test.ts
git commit -m "feat(shared): newsService CRUD (create/get/list/update)"
```

---

## Task 5 — newsService: reactions

**Files:**
- Modify: `packages/shared/src/services/newsService.ts`
- Modify: `packages/shared/test/services/newsService.test.ts`

- [ ] **Step 1: Write failing tests**

Add cases:
1. `reactToPost(postId, userId, kind)` writes a doc at id `${postId}_${userId}` with the kind.
2. Calling it twice with different kinds overwrites the same doc (one reaction per user per post).
3. `removeReaction(postId, userId)` deletes the deterministic doc.

- [ ] **Step 2: Run, confirm RED**

Run: `pnpm shared:test -- newsService`
Expected: FAIL — `reactToPost` not exported.

- [ ] **Step 3: Implement**

Append to `newsService.ts`:

```ts
// ────── reactions ──────
export async function reactToPost(
  postId: string,
  userId: string,
  municipalityId: string,
  kind: NewsReactionKind
): Promise<void> {
  const ref = doc(reactionsCol(), reactionDocId(postId, userId));
  await setDoc(ref, {
    postId,
    municipalityId,
    userId,
    kind,
    createdAt: serverTimestamp(),
  });
}

export async function removeReaction(postId: string, userId: string): Promise<void> {
  await deleteDoc(doc(reactionsCol(), reactionDocId(postId, userId)));
}

export async function getMyReaction(postId: string, userId: string): Promise<NewsReactionKind | null> {
  const snap = await getDoc(doc(reactionsCol(), reactionDocId(postId, userId)));
  if (!snap.exists()) return null;
  return snap.get('kind') as NewsReactionKind;
}
```

- [ ] **Step 4: GREEN + commit**

```
pnpm shared:test -- newsService
git add packages/shared/src/services/newsService.ts packages/shared/test/services/newsService.test.ts
git commit -m "feat(shared): newsService reactions"
```

---

## Task 6 — newsService: comments + reports

**Files:** same as Task 5.

- [ ] **Step 1: Write failing tests**

1. `addComment({ postId, municipalityId, authorUserId, body })` writes a comment with `hidden=false`.
2. `deleteOwnComment(commentId)` removes it.
3. `getComments(postId, { limit })` returns comments where `hidden=false`, ordered by `createdAt asc`.
4. `reportComment({ commentId, postId, municipalityId, reporterUserId, reason })` creates a report with `status='open'`.

- [ ] **Step 2: RED**

Run: `pnpm shared:test -- newsService` — FAIL.

- [ ] **Step 3: Implement**

Append:

```ts
// ────── comments ──────
export interface AddCommentInput {
  postId: string;
  municipalityId: string;
  authorUserId: string;
  body: string;
}

export async function addComment(input: AddCommentInput): Promise<string> {
  const ref = doc(commentsCol());
  await setDoc(ref, {
    postId: input.postId,
    municipalityId: input.municipalityId,
    authorUserId: input.authorUserId,
    body: input.body,
    createdAt: serverTimestamp(),
    hidden: false,
  });
  return ref.id;
}

export async function deleteOwnComment(commentId: string): Promise<void> {
  await deleteDoc(doc(commentsCol(), commentId));
}

export async function getComments(
  postId: string,
  options: { limit?: number } = {}
): Promise<{ id: string; postId: string; municipalityId: string; authorUserId: string; body: string; createdAt: Date; hidden: boolean }[]> {
  const constraints = [
    where('postId', '==', postId),
    where('hidden', '==', false),
    orderBy('createdAt', 'asc'),
  ];
  if (options.limit) constraints.push(fsLimit(options.limit));
  const q = query(commentsCol(), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      postId: data['postId'] as string,
      municipalityId: data['municipalityId'] as string,
      authorUserId: data['authorUserId'] as string,
      body: data['body'] as string,
      createdAt: (data['createdAt'] as Timestamp).toDate(),
      hidden: data['hidden'] as boolean,
    };
  });
}

// ────── reports ──────
export interface ReportCommentInput {
  commentId: string;
  postId: string;
  municipalityId: string;
  reporterUserId: string;
  reason: string;
}

export async function reportComment(input: ReportCommentInput): Promise<string> {
  const ref = doc(reportsCol());
  await setDoc(ref, {
    targetType: 'comment',
    targetId: input.commentId,
    postId: input.postId,
    municipalityId: input.municipalityId,
    reporterUserId: input.reporterUserId,
    reason: input.reason,
    createdAt: serverTimestamp(),
    status: 'open',
    resolvedBy: null,
    resolvedAt: null,
  });
  return ref.id;
}
```

- [ ] **Step 4: GREEN + commit**

```
pnpm shared:test -- newsService
git add packages/shared/src/services/newsService.ts packages/shared/test/services/newsService.test.ts
git commit -m "feat(shared): newsService comments and reports"
```

---

## Task 7 — newsService: feed queries (home + others)

**Files:** same.

- [ ] **Step 1: Write failing tests**

1. `getHomeFeed(homeMunicipalityId, { limit }) ` returns only `approved` posts in that municipality, ordered by `publishedAt desc`.
2. `getOtherVillagesFeed(homeMunicipalityId, { limit })` returns approved posts where `municipalityId != homeMunicipalityId`, ordered by `publishedAt desc`.

- [ ] **Step 2: RED**

Run: FAIL — methods not exported.

- [ ] **Step 3: Implement**

Append:

```ts
// ────── feed queries ──────
export async function getHomeFeed(
  homeMunicipalityId: string,
  options: { limit?: number; afterPublishedAt?: Date } = {}
): Promise<(NewsPostData & { id: string })[]> {
  const constraints = [
    where('municipalityId', '==', homeMunicipalityId),
    where('status', '==', 'approved'),
    orderBy('publishedAt', 'desc'),
  ];
  if (options.afterPublishedAt) constraints.push(startAfter(Timestamp.fromDate(options.afterPublishedAt)));
  if (options.limit) constraints.push(fsLimit(options.limit));
  const snap = await getDocs(query(newsCol(), ...constraints));
  return snap.docs.map((d) => mapNewsPostDoc(d as Parameters<typeof mapNewsPostDoc>[0]));
}

export async function getOtherVillagesFeed(
  homeMunicipalityId: string,
  options: { limit?: number; afterPublishedAt?: Date } = {}
): Promise<(NewsPostData & { id: string })[]> {
  // Firestore inequality + orderBy on the same field: use !=
  const constraints = [
    where('status', '==', 'approved'),
    where('municipalityId', '!=', homeMunicipalityId),
    orderBy('municipalityId'), // required by Firestore when using !=
    orderBy('publishedAt', 'desc'),
  ];
  if (options.afterPublishedAt) constraints.push(startAfter(Timestamp.fromDate(options.afterPublishedAt)));
  if (options.limit) constraints.push(fsLimit(options.limit));
  const snap = await getDocs(query(newsCol(), ...constraints));
  return snap.docs.map((d) => mapNewsPostDoc(d as Parameters<typeof mapNewsPostDoc>[0]));
}
```

> If during implementation the Firestore emulator complains about the `!=` + `orderBy` combination, fall back to a single `(status, publishedAt)` query and partition client-side. Document the decision in a comment. The risk is listed in the spec.

- [ ] **Step 4: GREEN + commit**

```
pnpm shared:test -- newsService
git add packages/shared/src/services/newsService.ts packages/shared/test/services/newsService.test.ts
git commit -m "feat(shared): newsService home + other-villages feed queries"
```

---

## Task 8 — Re-export newsService and update services map

**Files:**
- Modify: `packages/shared/src/services/index.ts`
- Modify: `packages/shared/src/services/_services-map.md`

- [ ] **Step 1: Add re-export**

In `packages/shared/src/services/index.ts`, add `export * from './newsService';` in alphabetical position.

- [ ] **Step 2: Update services map**

In `packages/shared/src/services/_services-map.md`, add a row (alphabetical):

```markdown
| [newsService](newsService.ts) | `news/`, `newsComments/`, `newsReactions/`, `newsReports/` (all top-level, `municipalityId` field) | Village news feed: create/get/list/update posts, react, comment, report comments, fetch home + other-villages feeds. Cross-user moderation lives in Cloud Functions. | `createNewsPost`, `getNewsPost`, `getNewsPostsByMunicipality`, `updateNewsPost`, `reactToPost`, `removeReaction`, `getMyReaction`, `addComment`, `getComments`, `deleteOwnComment`, `reportComment`, `getHomeFeed`, `getOtherVillagesFeed` |
```

Also fix the lead-in note at the top of the file: replace the `villages/{villageId}/...` reference with current architecture wording. Replace the first paragraph that begins with "Collection paths" with:

```markdown
> Collection paths reflect today's architecture: **first-class top-level collections** (`events/`, `organizations/`, `news/`, …) scoped by a `municipalityId` field, plus a small number of genuinely nested collections (`users/{uid}/notifications/`, `events/{eventId}/registrations/`, `organizations/{orgId}/members/`, `municipalities/{id}/members/`). See AGENTS.md §3 for the rationale.
```

Touch only the lead-in note and the new row in this task; do not rewrite the other stale rows wholesale — they're a separate cleanup.

- [ ] **Step 3: Commit**

```
pnpm shared:test
git add packages/shared/src/services/index.ts packages/shared/src/services/_services-map.md
git commit -m "feat(shared): export newsService and register it in the services map"
```

---

## Task 9 — Firestore rules (TDD via rules e2e)

**Files:**
- Modify: `firestore.rules`
- Create: `packages/shared/test/e2e/newsRules.test.ts`

Follow `packages/shared/test/e2e/villageRules.test.ts` for the rules-test harness.

- [ ] **Step 1: Write failing rules tests**

In `packages/shared/test/e2e/newsRules.test.ts`, cover at minimum:

| # | Scenario | Expected |
|---|---|---|
| 1 | non-member tries to create a `news` doc | DENY |
| 2 | member with `trustedNewsAuthor=false` creates with `status: 'pending'` | ALLOW |
| 3 | same member tries to create with `status: 'approved'` | DENY |
| 4 | member with `trustedNewsAuthor=true` creates with `status: 'approved'` | ALLOW |
| 5 | author updates own post (title/body only) | ALLOW |
| 6 | author tries to update own post's `status` to 'approved' | DENY |
| 7 | non-author updates someone else's post | DENY |
| 8 | client tries to delete a news post directly | DENY |
| 9 | member adds a comment with `hidden=false` | ALLOW |
| 10 | member tries to set `hidden=true` on a new comment | DENY |
| 11 | member tries to update an existing comment | DENY |
| 12 | comment author deletes their own comment | ALLOW |
| 13 | member creates a reaction at id `${postId}_${myUid}` | ALLOW |
| 14 | member tries to create a reaction at id `${postId}_${otherUid}` | DENY |
| 15 | member submits a report with `status='open'` and `reporterUserId=myUid` | ALLOW |
| 16 | client tries to update a report directly | DENY |
| 17 | client tries to write `trustedNewsAuthor=true` on their own member doc | DENY |

- [ ] **Step 2: RED**

Run: `pnpm test:rules` — FAIL on every case (the rules block doesn't exist yet).

- [ ] **Step 3: Implement rules**

In `firestore.rules`, add — inside `match /databases/{database}/documents { ... }`, after the existing helpers and before `match /admins/...` — new helper:

```
function isTrustedNewsAuthor(municipalityId) {
  return isAuthenticated()
    && exists(/databases/$(database)/documents/municipalities/$(municipalityId)/members/$(request.auth.uid))
    && get(/databases/$(database)/documents/municipalities/$(municipalityId)/members/$(request.auth.uid)).data.trustedNewsAuthor == true;
}
```

Then add new match blocks at the top level (siblings of `match /events/...`):

```
match /news/{postId} {
  allow read: if isVillageMember(resource.data.municipalityId);
  allow create: if isVillageMember(request.resource.data.municipalityId)
                  && request.resource.data.authorUserId == request.auth.uid
                  && request.resource.data.createdBy == request.auth.uid
                  && request.resource.data.publishedAt == null
                  && request.resource.data.reactionCounts.like == 0
                  && request.resource.data.reactionCounts.heart == 0
                  && request.resource.data.commentCount == 0
                  && (
                    request.resource.data.status == 'pending'
                    || (request.resource.data.status == 'approved'
                        && isTrustedNewsAuthor(request.resource.data.municipalityId))
                  );
  allow update: if isOwner(resource.data.createdBy)
                  && !request.resource.data.diff(resource.data).affectedKeys().hasAny([
                       'status','publishedAt','authorUserId','authorOrgId',
                       'municipalityId','submittedAt','createdBy',
                       'reactionCounts','commentCount'
                     ]);
  allow delete: if false;
}

match /newsComments/{commentId} {
  allow read: if isVillageMember(resource.data.municipalityId);
  allow create: if isVillageMember(request.resource.data.municipalityId)
                  && request.resource.data.authorUserId == request.auth.uid
                  && request.resource.data.hidden == false;
  allow update: if false;
  allow delete: if isOwner(resource.data.authorUserId);
}

match /newsReactions/{reactionId} {
  allow read: if isVillageMember(resource.data.municipalityId);
  allow create, update: if isVillageMember(request.resource.data.municipalityId)
                          && request.resource.data.userId == request.auth.uid
                          && reactionId == request.resource.data.postId + '_' + request.auth.uid;
  allow delete: if isOwner(resource.data.userId);
}

match /newsReports/{reportId} {
  allow read: if isVillageAdmin(resource.data.municipalityId)
                || isOwner(resource.data.reporterUserId)
                || isAppAdmin();
  allow create: if isVillageMember(request.resource.data.municipalityId)
                  && request.resource.data.reporterUserId == request.auth.uid
                  && request.resource.data.status == 'open'
                  && request.resource.data.resolvedBy == null
                  && request.resource.data.resolvedAt == null;
  allow update, delete: if false;
}
```

Then tighten the existing `match /municipalities/{municipalityId}/members/{userId}` `allow update` clause so the client cannot set `trustedNewsAuthor`. Replace the current `allow update` line with:

```
allow update: if (
  (isVillageAdmin(municipalityId) || isAppAdmin())
  && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['trustedNewsAuthor'])
)
|| (isOwner(userId)
    && request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['profileAnswers', 'profileCompletedAt']));
```

(That is: even admins can't flip `trustedNewsAuthor` via direct write — only the callable can.)

- [ ] **Step 4: GREEN**

Run: `pnpm test:rules` — all 17 cases pass.

- [ ] **Step 5: Commit**

```
git add firestore.rules packages/shared/test/e2e/newsRules.test.ts
git commit -m "feat(rules): news, newsComments, newsReactions, newsReports; lock trustedNewsAuthor"
```

---

## Task 10 — Firestore indexes

**Files:**
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Add indexes**

Add four entries under `indexes`:

```json
{
  "collectionGroup": "news",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "municipalityId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "publishedAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "news",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "municipalityId", "order": "ASCENDING" },
    { "fieldPath": "publishedAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "newsComments",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "postId", "order": "ASCENDING" },
    { "fieldPath": "hidden", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "newsReports",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "municipalityId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

- [ ] **Step 2: Commit**

```
git add firestore.indexes.json
git commit -m "feat(indexes): add composite indexes for news feed queries"
```

---

## Task 11 — Storage rules for news images

**Files:**
- Modify: `storage.rules`

- [ ] **Step 1: Inspect existing storage.rules to understand the pattern for events/persons images.**

- [ ] **Step 2: Add a match block for `news/{postId}/images/{imageId}`**

```
match /news/{postId}/images/{imageId} {
  allow read: if request.auth != null;
  // Only the post author may write (firestore lookup):
  allow write: if request.auth != null
    && firestore.get(/databases/(default)/documents/news/$(postId)).data.authorUserId == request.auth.uid;
  allow delete: if request.auth != null
    && firestore.get(/databases/(default)/documents/news/$(postId)).data.authorUserId == request.auth.uid;
}
```

If `storage.rules` uses a different style (size limits etc.), follow that.

- [ ] **Step 3: Commit**

```
git add storage.rules
git commit -m "feat(storage): allow news authors to upload images"
```

---

## Task 12 — Cloud Function: moderateNewsPost

**Files:**
- Create: `functions/src/news/moderateNewsPost.ts`
- Create: `functions/test/news/moderateNewsPost.test.ts`
- Modify: `functions/src/index.ts`

Follow `functions/src/respondToJoinRequest.ts` for the callable structure. Use `logger.info(msg, { handler: 'moderateNewsPost', ...fields })` per `cloud-function-logging`.

- [ ] **Step 1: Write failing emulator test**

`functions/test/news/moderateNewsPost.test.ts` — assert:
1. Non-admin caller → `permission-denied`.
2. Admin approves a pending post → `status='approved'`, `publishedAt` set, `rejectionReason=null`.
3. Admin rejects a pending post with reason → `status='rejected'`, `rejectionReason='spam'`, `publishedAt` remains null.
4. Admin tries to moderate a post that is already approved → `failed-precondition`.

- [ ] **Step 2: RED**

Run: `pnpm --filter functions test -- moderateNewsPost` — FAIL.

- [ ] **Step 3: Implement**

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

interface ModerateNewsPostData {
  postId?: string;
  decision?: 'approved' | 'rejected';
  reason?: string;
}

export const moderateNewsPost = onCall<ModerateNewsPostData, Promise<{ ok: true }>>(
  { region: 'us-central1', cors: true },
  async (request) => {
    const handler = 'moderateNewsPost';
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

    const { postId, decision, reason } = request.data ?? {};
    if (!postId || (decision !== 'approved' && decision !== 'rejected')) {
      throw new HttpsError('invalid-argument', 'Argumentos inválidos.');
    }

    const postRef = db.doc(`news/${postId}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(postRef);
      if (!snap.exists) throw new HttpsError('not-found', 'Post no encontrado.');
      if (snap.get('status') !== 'pending') {
        throw new HttpsError('failed-precondition', 'El post ya fue moderado.');
      }
      const municipalityId = snap.get('municipalityId') as string;

      const callerMember = await tx.get(db.doc(`municipalities/${municipalityId}/members/${auth.uid}`));
      const isAdmin = callerMember.exists && callerMember.get('role') === 'admin';
      const appAdminSnap = await tx.get(db.doc(`admins/${auth.uid}`));
      if (!isAdmin && !appAdminSnap.exists) {
        throw new HttpsError('permission-denied', 'No autorizado.');
      }

      const patch =
        decision === 'approved'
          ? { status: 'approved', publishedAt: FieldValue.serverTimestamp(), rejectionReason: null, updatedAt: FieldValue.serverTimestamp() }
          : { status: 'rejected', rejectionReason: reason ?? null, updatedAt: FieldValue.serverTimestamp() };
      tx.update(postRef, patch);
    });

    logger.info('moderated news post', { handler, postId, decision });
    return { ok: true };
  }
);
```

- [ ] **Step 4: Wire export**

In `functions/src/index.ts`, add:

```ts
export { moderateNewsPost } from './news/moderateNewsPost';
```

- [ ] **Step 5: GREEN + commit**

```
pnpm --filter functions test -- moderateNewsPost
git add functions/src/news/moderateNewsPost.ts functions/src/index.ts functions/test/news/moderateNewsPost.test.ts
git commit -m "feat(functions): moderateNewsPost callable"
```

---

## Task 13 — Cloud Function: deleteNewsPost (cascade)

Same pattern as Task 12. Cascades by deleting:
- The post doc.
- All `newsComments` where `postId == postId`.
- All `newsReactions` where `postId == postId`.
- All `newsReports` where `postId == postId` and `status == 'open'` (close them with `status='actioned'`).

Permission: municipality admin or app admin.

Test cases:
1. Non-admin → `permission-denied`.
2. Admin deletes a post with N comments, M reactions, K open reports → all gone (comments + reactions) and reports moved to `actioned` with `resolvedBy=auth.uid`.
3. Admin deletes a non-existent post → `not-found`.

Implementation: use a batched-write loop in pages of 500 (Firestore batch limit) for comments and reactions. Use `db.recursiveDelete(postRef)` is NOT available in client SDK but the Admin SDK supports `db.recursiveDelete`. Cleaner: explicit query + chunked batch delete. Use `logger.info` with `handler: 'deleteNewsPost'`.

- [ ] Same Steps 1–5 as Task 12. End with:

```
git commit -m "feat(functions): deleteNewsPost callable with cascade"
```

---

## Task 14 — Cloud Function: setTrustedNewsAuthor

**Files:**
- Create: `functions/src/news/setTrustedNewsAuthor.ts`
- Create: `functions/test/news/setTrustedNewsAuthor.test.ts`
- Modify: `functions/src/index.ts`

Permission: municipality admin or app admin. Toggles `trustedNewsAuthor` on `municipalities/{municipalityId}/members/{targetUserId}`. Errors:
- Caller not admin → `permission-denied`.
- Target user is not a member of the municipality → `not-found`.

Test cases:
1. Non-admin caller → `permission-denied`.
2. Admin sets `trustedNewsAuthor=true` on an existing member → member doc updated.
3. Admin sets it back to `false` → member doc updated.
4. Target is not a member → `not-found`.

Implementation skeleton (follow Task 12 patterns):

```ts
// Input: { municipalityId, userId, trusted }
// Verify caller is village admin of municipalityId (or app admin).
// db.doc(`municipalities/${municipalityId}/members/${userId}`).update({ trustedNewsAuthor: trusted });
// logger.info('toggled trustedNewsAuthor', { handler, municipalityId, userId, trusted });
```

- [ ] Same Steps 1–5. End with:

```
git commit -m "feat(functions): setTrustedNewsAuthor callable"
```

---

## Task 15 — Cloud Function: resolveNewsReport

**Files:**
- Create: `functions/src/news/resolveNewsReport.ts`
- Create: `functions/test/news/resolveNewsReport.test.ts`
- Modify: `functions/src/index.ts`

Input: `{ reportId, action: 'dismiss' | 'remove' }`.
- `dismiss` → mark report `status='dismissed'`, set `resolvedBy=auth.uid`, `resolvedAt=now`.
- `remove` → also flip `hidden=true` on the target comment.

Permission: municipality admin (of the report's `municipalityId`) or app admin.

Test cases:
1. Non-admin → `permission-denied`.
2. Admin dismisses report → status `dismissed`, comment untouched.
3. Admin removes → status `actioned`, comment `hidden=true`.
4. Already-resolved report → `failed-precondition`.

- [ ] Same Steps 1–5. End with:

```
git commit -m "feat(functions): resolveNewsReport callable"
```

---

## Task 16 — Firestore trigger: syncNewsReactionCounts

**Files:**
- Create: `functions/src/news/syncNewsReactionCounts.ts`
- Create: `functions/test/news/syncNewsCounters.test.ts` (shared with Task 17)
- Modify: `functions/src/index.ts`

Trigger on `newsReactions/{reactionId}` for create / update / delete. On change, recompute the impacted post's `reactionCounts` using `FieldValue.increment(±1)` for each affected kind. Pattern: follow `functions/src/syncVillageDenormalization.ts`.

Cases to handle in one trigger:
- onCreate: increment `reactionCounts[kind]` by 1.
- onDelete: decrement `reactionCounts[kind]` by 1, floored at 0 (clamp by reading the post in a transaction; or rely on the counter never going negative under normal flow and add a `Math.max` reconciliation later — pick the simpler `increment(-1)` here, document the drift risk in a comment per the spec's open question).
- onUpdate: if `kind` changed, decrement old, increment new.

Test cases (against the Firestore emulator, in `functions/test/news/syncNewsCounters.test.ts`):
1. Creating two `like` reactions then one `heart` reaches `{like:2,heart:1}`.
2. Deleting a `like` decrements to `{like:1,heart:1}`.
3. Switching a reaction's kind from `like` to `heart` reaches `{like:0,heart:2}`.

- [ ] Same Steps 1–5. End with:

```
git commit -m "feat(functions): syncNewsReactionCounts trigger"
```

---

## Task 17 — Firestore trigger: syncNewsCommentCount

**Files:**
- Create: `functions/src/news/syncNewsCommentCount.ts`
- Extend: `functions/test/news/syncNewsCounters.test.ts`
- Modify: `functions/src/index.ts`

Trigger on `newsComments/{commentId}` for create / update / delete:
- onCreate where `hidden=false`: increment `commentCount` by 1.
- onDelete where `hidden=false`: decrement by 1.
- onUpdate: if `hidden` flipped from false→true, decrement; from true→false, increment.

Test cases:
1. Two new comments → `commentCount=2`.
2. Hiding one (via the resolveNewsReport flow) → `commentCount=1`.
3. Deleting a visible comment → decrements; deleting an already-hidden comment → no change.

- [ ] Same Steps 1–5. End with:

```
git commit -m "feat(functions): syncNewsCommentCount trigger"
```

---

## Task 18 — i18n strings

**Files:**
- Create: `packages/i18n/messages/news/es.json` (and any peer locale files following the existing structure)

Strings to add (minimum set):

```
news.feed.title = "Noticias"
news.feed.tab.home = "Mi pueblo"
news.feed.tab.others = "Otros pueblos"
news.feed.empty = "Aún no hay noticias."

news.compose.title = "Nueva noticia"
news.compose.titleLabel = "Título"
news.compose.bodyLabel = "Contenido"
news.compose.categoryLabel = "Categoría"
news.compose.category.fiesta = "Fiesta"
news.compose.category.tradicion = "Tradición"
news.compose.category.gastronomia = "Gastronomía"
news.compose.category.historia = "Historia"
news.compose.category.otro = "Otro"
news.compose.imagesLabel = "Imágenes"
news.compose.submit = "Enviar"
news.compose.submitTrusted = "Publicar"
news.compose.postAsOrg = "Publicar como…"

news.status.pending = "Pendiente de aprobación"
news.status.rejected = "Rechazada"
news.status.rejectedReason = "Motivo: {reason}"

news.reactions.like = "Me gusta"
news.reactions.heart = "Me encanta"

news.comments.title = "Comentarios"
news.comments.empty = "Sé el primero en comentar."
news.comments.placeholder = "Escribe un comentario…"
news.comments.send = "Enviar"
news.comments.report = "Reportar"
news.comments.reportConfirm = "¿Reportar este comentario?"
news.comments.reportSent = "Reporte enviado."

news.moderation.queueTitle = "Noticias pendientes"
news.moderation.approve = "Aprobar"
news.moderation.reject = "Rechazar"
news.moderation.rejectReasonPrompt = "Motivo del rechazo"
news.moderation.reportsTitle = "Reportes"
news.moderation.dismiss = "Descartar"
news.moderation.remove = "Eliminar comentario"
news.moderation.trustToggle = "Autor de confianza"
```

Follow `i18n-add-string` skill for file placement and consumption.

- [ ] Commit:

```
git add packages/i18n/
git commit -m "feat(i18n): add news namespace (es)"
```

---

## Task 19 — Full test suite + lint + verification before merge

- [ ] **Step 1: Run the full check suite**

Run: `pnpm check`
Expected: all green (typecheck, lint, shared tests, functions tests, rules tests).

- [ ] **Step 2: Push the branch**

```
git push -u origin feat/news-feed
```

- [ ] **Step 3: Report back**

Summarize tasks completed, test counts, and next steps (mobile UI plan, web UI plan).

---

## Out of scope for this plan (intentional)

- Mobile UI surfaces (feed list, post detail, composer, moderation queue, member admin toggle).
- Web UI mirror of the above.
- Push notifications (V2).
- Reporting posts (only comments are reportable in V1).
- Markdown rendering of post bodies (plain text is sufficient for V1).
- Edit re-moderation (intentionally not done per spec).
- Counter drift reconciliation job (deferred per spec).

These will be addressed in follow-up plans once this backend lands and passes `pnpm check`.
