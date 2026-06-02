import {
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
} from 'firebase/firestore';
import { getDb } from '../firebase';
import {
  newsCollection,
  newsDoc,
  newsCommentsCollection,
  newsCommentDoc,
  newsReactionDoc,
  newsReportsCollection,
} from '../firebase/refs/client';
import {
  buildNewsPostData,
  type NewsPostData,
  type NewsPostCategory,
  type NewsPostImage,
  type NewsPostStatus,
  type NewsReactionKind,
} from '../models/news/NewsPostDataModel';
import {
  buildNewsCommentData,
  type NewsCommentData,
} from '../models/news/NewsCommentDataModel';
import {
  buildNewsReactionData,
  reactionDocId,
} from '../models/news/NewsReactionDataModel';
import { buildNewsReportData } from '../models/news/NewsReportDataModel';

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

const FORBIDDEN_UPDATE_KEYS = new Set<string>([
  'status',
  'publishedAt',
  'authorUserId',
  'municipalityId',
  'submittedAt',
  'createdBy',
  'reactionCounts',
  'commentCount',
]);

// ────── post CRUD ──────
export async function createNewsPost(input: CreateNewsPostInput): Promise<string> {
  // doc() on a typed collection ref yields an auto-id typed doc ref.
  const ref = doc(newsCollection(getDb()));
  const now = new Date();
  // setDoc routes through the typed converter — submittedAt/updatedAt must be
  // plain Dates (serverTimestamp sentinels are rejected by the schema).
  await setDoc(
    ref,
    buildNewsPostData({
      municipalityId: input.municipalityId,
      authorUserId: input.authorUserId,
      authorOrgId: input.authorOrgId ?? null,
      title: input.title,
      body: input.body,
      category: input.category,
      images: input.images ?? [],
      submittedAt: now,
      createdBy: input.authorUserId,
      updatedAt: now,
    }),
  );
  return ref.id;
}

export async function getNewsPost(
  id: string,
): Promise<(NewsPostData & { id: string }) | null> {
  const snap = await getDoc(newsDoc(getDb(), id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getNewsPostsByMunicipality(
  municipalityId: string,
  options: { status?: NewsPostStatus; limit?: number; afterPublishedAt?: Date } = {},
): Promise<(NewsPostData & { id: string })[]> {
  const constraints = [
    where('municipalityId', '==', municipalityId),
    ...(options.status ? [where('status', '==', options.status)] : []),
    orderBy('publishedAt', 'desc'),
    ...(options.afterPublishedAt
      ? [startAfter(Timestamp.fromDate(options.afterPublishedAt))]
      : []),
    ...(options.limit ? [fsLimit(options.limit)] : []),
  ];
  const q = query(newsCollection(getDb()), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateNewsPost(id: string, patch: UpdateNewsPostInput): Promise<void> {
  for (const k of Object.keys(patch)) {
    if (FORBIDDEN_UPDATE_KEYS.has(k)) {
      throw new Error(`updateNewsPost: cannot modify field "${k}" from the client`);
    }
  }
  // updateDoc bypasses the converter, so partial-update payloads (and the
  // serverTimestamp sentinel) go on the raw doc ref rather than the typed one.
  await updateDoc(doc(getDb(), 'news', id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

// ────── reactions ──────
export async function reactToPost(
  postId: string,
  userId: string,
  municipalityId: string,
  kind: NewsReactionKind,
): Promise<void> {
  const ref = newsReactionDoc(getDb(), reactionDocId(postId, userId));
  await setDoc(
    ref,
    buildNewsReactionData({
      postId,
      municipalityId,
      userId,
      kind,
      createdAt: new Date(),
    }),
  );
}

export async function removeReaction(postId: string, userId: string): Promise<void> {
  await deleteDoc(newsReactionDoc(getDb(), reactionDocId(postId, userId)));
}

export async function getMyReaction(
  postId: string,
  userId: string,
): Promise<NewsReactionKind | null> {
  const snap = await getDoc(newsReactionDoc(getDb(), reactionDocId(postId, userId)));
  if (!snap.exists()) return null;
  return snap.data().kind;
}

// ────── comments ──────
export interface AddCommentInput {
  postId: string;
  municipalityId: string;
  authorUserId: string;
  body: string;
}

export async function addComment(input: AddCommentInput): Promise<string> {
  const ref = doc(newsCommentsCollection(getDb()));
  await setDoc(
    ref,
    buildNewsCommentData({
      postId: input.postId,
      municipalityId: input.municipalityId,
      authorUserId: input.authorUserId,
      body: input.body,
      createdAt: new Date(),
    }),
  );
  return ref.id;
}

export async function deleteOwnComment(commentId: string): Promise<void> {
  await deleteDoc(newsCommentDoc(getDb(), commentId));
}

export async function getComments(
  postId: string,
  options: { limit?: number } = {},
): Promise<(NewsCommentData & { id: string })[]> {
  const constraints = [
    where('postId', '==', postId),
    where('hidden', '==', false),
    orderBy('createdAt', 'asc'),
    ...(options.limit ? [fsLimit(options.limit)] : []),
  ];
  const q = query(newsCommentsCollection(getDb()), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
  const ref = doc(newsReportsCollection(getDb()));
  await setDoc(
    ref,
    buildNewsReportData({
      targetType: 'comment',
      targetId: input.commentId,
      postId: input.postId,
      municipalityId: input.municipalityId,
      reporterUserId: input.reporterUserId,
      reason: input.reason,
      createdAt: new Date(),
    }),
  );
  return ref.id;
}

// ────── feed queries ──────
export async function getHomeFeed(
  homeMunicipalityId: string,
  options: { limit?: number; afterPublishedAt?: Date } = {},
): Promise<(NewsPostData & { id: string })[]> {
  const constraints = [
    where('municipalityId', '==', homeMunicipalityId),
    where('status', '==', 'approved'),
    orderBy('publishedAt', 'desc'),
    ...(options.afterPublishedAt
      ? [startAfter(Timestamp.fromDate(options.afterPublishedAt))]
      : []),
    ...(options.limit ? [fsLimit(options.limit)] : []),
  ];
  const snap = await getDocs(query(newsCollection(getDb()), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getOtherVillagesFeed(
  homeMunicipalityId: string,
  options: { limit?: number; afterPublishedAt?: Date } = {},
): Promise<(NewsPostData & { id: string })[]> {
  // NOTE: Firestore requires that when using != on a field, the first orderBy
  // must be on that same field. The compound index (status ASC, municipalityId
  // ASC, publishedAt DESC) declared in firestore.indexes.json supports this.
  const constraints = [
    where('status', '==', 'approved'),
    where('municipalityId', '!=', homeMunicipalityId),
    orderBy('municipalityId'),
    orderBy('publishedAt', 'desc'),
    ...(options.afterPublishedAt
      ? [startAfter(Timestamp.fromDate(options.afterPublishedAt))]
      : []),
    ...(options.limit ? [fsLimit(options.limit)] : []),
  ];
  const snap = await getDocs(query(newsCollection(getDb()), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
