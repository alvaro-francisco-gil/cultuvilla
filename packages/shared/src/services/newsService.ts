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
} from 'firebase/firestore';
import { getDb } from '../firebase';
import type {
  NewsPostData,
  NewsPostCategory,
  NewsPostImage,
  NewsPostStatus,
  NewsReactionKind,
} from '../models/news/NewsPostDataModel';
import { reactionDocId } from '../models/news/NewsReactionDataModel';

// ────── collections ──────
function newsCol() {
  return collection(getDb(), 'news');
}
function commentsCol() {
  return collection(getDb(), 'newsComments');
}
function reactionsCol() {
  return collection(getDb(), 'newsReactions');
}
function reportsCol() {
  return collection(getDb(), 'newsReports');
}

// ────── doc mapper ──────
export function mapNewsPostDoc(d: {
  id: string;
  data: () => Record<string, unknown>;
}): NewsPostData & { id: string } {
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
    images: (data['images'] as NewsPostImage[]) ?? [],
    status: data['status'] as NewsPostStatus,
    rejectionReason: (data['rejectionReason'] as string | null) ?? null,
    submittedAt: (data['submittedAt'] as Timestamp).toDate(),
    publishedAt: publishedAtRaw ? (publishedAtRaw as Timestamp).toDate() : null,
    createdBy: data['createdBy'] as string,
    updatedAt: (data['updatedAt'] as Timestamp).toDate(),
    reactionCounts: (data['reactionCounts'] as { like: number; heart: number }) ?? {
      like: 0,
      heart: 0,
    },
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

export async function getNewsPost(
  id: string,
): Promise<(NewsPostData & { id: string }) | null> {
  const snap = await getDoc(doc(newsCol(), id));
  if (!snap.exists()) return null;
  return mapNewsPostDoc(snap as Parameters<typeof mapNewsPostDoc>[0]);
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
  const q = query(newsCol(), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapNewsPostDoc(d as Parameters<typeof mapNewsPostDoc>[0]));
}

export async function updateNewsPost(id: string, patch: UpdateNewsPostInput): Promise<void> {
  for (const k of Object.keys(patch)) {
    if (FORBIDDEN_UPDATE_KEYS.has(k)) {
      throw new Error(`updateNewsPost: cannot modify field "${k}" from the client`);
    }
  }
  await updateDoc(doc(newsCol(), id), {
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

export async function getMyReaction(
  postId: string,
  userId: string,
): Promise<NewsReactionKind | null> {
  const snap = await getDoc(doc(reactionsCol(), reactionDocId(postId, userId)));
  if (!snap.exists()) return null;
  return snap.get('kind') as NewsReactionKind;
}

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
  options: { limit?: number } = {},
): Promise<
  {
    id: string;
    postId: string;
    municipalityId: string;
    authorUserId: string;
    body: string;
    createdAt: Date;
    hidden: boolean;
  }[]
> {
  const constraints = [
    where('postId', '==', postId),
    where('hidden', '==', false),
    orderBy('createdAt', 'asc'),
    ...(options.limit ? [fsLimit(options.limit)] : []),
  ];
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
  const snap = await getDocs(query(newsCol(), ...constraints));
  return snap.docs.map((d) => mapNewsPostDoc(d as Parameters<typeof mapNewsPostDoc>[0]));
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
  const snap = await getDocs(query(newsCol(), ...constraints));
  return snap.docs.map((d) => mapNewsPostDoc(d as Parameters<typeof mapNewsPostDoc>[0]));
}
