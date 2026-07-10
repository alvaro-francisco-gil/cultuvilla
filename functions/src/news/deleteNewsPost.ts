import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  adminDoc,
  municipalityMemberDoc,
  newsDoc,
  newsCommentsCollection,
  newsReactionsCollection,
  newsReportsCollection,
} from '@cultuvilla/shared/firebase/refs/admin';

const db = admin.firestore();

interface DeleteNewsPostData {
  postId?: string;
}

interface DeleteNewsPostResult {
  ok: true;
}

async function isAdminCaller(uid: string, municipalityId: string): Promise<boolean> {
  const [callerMemberSnap, appAdminSnap] = await Promise.all([
    municipalityMemberDoc(db, municipalityId, uid).get(),
    adminDoc(db, uid).get(),
  ]);
  return (callerMemberSnap.exists && callerMemberSnap.get('role') === 'admin') || appAdminSnap.exists;
}

async function batchDeleteQuery(
  query: admin.firestore.Query,
): Promise<void> {
  let snap = await query.limit(500).get();
  while (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < 500) break;
    snap = await query.limit(500).startAfter(snap.docs[snap.docs.length - 1]).get();
  }
}

export const deleteNewsPost = onCall<DeleteNewsPostData, Promise<DeleteNewsPostResult>>(
  { region: 'us-central1', cors: true },
  async (request) => {
    const handler = 'deleteNewsPost';
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

    const { postId } = request.data;
    if (!postId) throw new HttpsError('invalid-argument', 'Argumentos inválidos.');

    const postRef = newsDoc(db, postId);
    const postSnap = await postRef.get();
    const post = postSnap.data();
    if (!post) throw new HttpsError('not-found', 'Post no encontrado.');

    // Converter-wrapped: typed NewsPostData. The author may delete their own
    // post; village/app admins may delete any post in their village.
    const municipalityId = post.municipalityId;
    const authorized = post.createdBy === auth.uid || (await isAdminCaller(auth.uid, municipalityId));
    if (!authorized) throw new HttpsError('permission-denied', 'No autorizado.');

    // Delete newsComments for this post (top-level collection, must be explicit)
    await batchDeleteQuery(newsCommentsCollection(db).where('postId', '==', postId));

    // Delete newsReactions for this post (top-level collection, must be explicit)
    await batchDeleteQuery(newsReactionsCollection(db).where('postId', '==', postId));

    // Close open newsReports for this post (mark as actioned, not deleted)
    const openReports = await newsReportsCollection(db)
      .where('postId', '==', postId)
      .where('status', '==', 'open')
      .get();

    if (!openReports.empty) {
      const now = FieldValue.serverTimestamp();
      for (let i = 0; i < openReports.docs.length; i += 500) {
        const batch = db.batch();
        openReports.docs.slice(i, i + 500).forEach((d) =>
          // Partial update; bypass converter via raw doc ref.
          batch.update(db.doc(d.ref.path), { status: 'actioned', resolvedBy: auth.uid, resolvedAt: now }),
        );
        await batch.commit();
      }
    }

    // Delete the post document last
    await postRef.delete();

    logger.info('deleted news post with cascade', { handler, postId, municipalityId });
    return { ok: true };
  },
);
