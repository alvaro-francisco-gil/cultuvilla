import {
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit as fsLimit,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDb, getFirebaseFunctions } from '../firebase';
import { commentsCollection, commentDoc } from '../firebase/refs/client';
import { buildCommentData, type CommentData } from '../models/interaction/CommentDataModel';
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

export interface RecordEntityViewInput {
  entityKind: EntityKind;
  entityId: string;
  municipalityId: string;
}

export async function recordEntityView(input: RecordEntityViewInput): Promise<void> {
  const fn = httpsCallable<RecordEntityViewInput>(getFirebaseFunctions(), 'recordEntityView');
  await fn(input);
}
