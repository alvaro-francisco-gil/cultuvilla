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

interface ModerateNewsPostResult {
  ok: true;
}

export const moderateNewsPost = onCall<ModerateNewsPostData, Promise<ModerateNewsPostResult>>(
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
      const callerMemberRef = db.doc(`municipalities/${municipalityId}/members/${auth.uid}`);
      const appAdminRef = db.doc(`admins/${auth.uid}`);

      const [callerMemberSnap, appAdminSnap] = await Promise.all([
        tx.get(callerMemberRef),
        tx.get(appAdminRef),
      ]);

      const isVillageAdmin = callerMemberSnap.exists && callerMemberSnap.get('role') === 'admin';
      const isAppAdmin = appAdminSnap.exists;

      if (!isVillageAdmin && !isAppAdmin) {
        throw new HttpsError('permission-denied', 'No autorizado.');
      }

      const patch =
        decision === 'approved'
          ? {
              status: 'approved',
              publishedAt: FieldValue.serverTimestamp(),
              rejectionReason: null,
              updatedAt: FieldValue.serverTimestamp(),
            }
          : {
              status: 'rejected',
              rejectionReason: reason ?? null,
              updatedAt: FieldValue.serverTimestamp(),
            };

      tx.update(postRef, patch);
    });

    logger.info('moderated news post', { handler, postId, decision });
    return { ok: true };
  },
);
