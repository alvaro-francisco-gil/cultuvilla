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
import { commentsCollection, commentDoc, reactionDoc } from '../firebase/refs/client';
import { buildCommentData, type CommentData } from '../models/interaction/CommentDataModel';
import { buildReactionData, reactionDocId, type ReactionKind } from '../models/interaction/ReactionDataModel';
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

export async function removeReaction(entityKind: EntityKind, entityId: string, userId: string): Promise<void> {
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
