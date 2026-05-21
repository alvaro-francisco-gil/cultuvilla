import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

interface RespondToOrganizerRequestData {
  requestId?: string;
  decision?: 'approved' | 'rejected';
}

interface RespondToOrganizerRequestResult {
  ok: true;
}

export const respondToOrganizerRequest = onCall<
  RespondToOrganizerRequestData,
  Promise<RespondToOrganizerRequestResult>
>(
  { region: 'us-central1', cors: true },
  async (request) => {
    const handler = 'respondToOrganizerRequest';
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

    const { requestId, decision } = request.data ?? {};
    if (!requestId || (decision !== 'approved' && decision !== 'rejected')) {
      throw new HttpsError('invalid-argument', 'Argumentos inválidos.');
    }

    const callerUid = auth.uid;
    const adminSnap = await db.doc(`admins/${callerUid}`).get();
    if (!adminSnap.exists) {
      throw new HttpsError('permission-denied', 'Sólo superadmin.');
    }

    const reqRef = db.doc(`organizerRequests/${requestId}`);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(reqRef);
      if (!snap.exists) throw new HttpsError('not-found', 'Solicitud no encontrada.');
      if (snap.get('status') !== 'pending') {
        throw new HttpsError('failed-precondition', 'La solicitud ya fue resuelta.');
      }

      const requesterUid = snap.get('userId') as string;
      const municipalityId = snap.get('municipalityId') as string;
      const muniRef = db.doc(`municipalities/${municipalityId}`);
      const muniSnap = await tx.get(muniRef);
      if (!muniSnap.exists) throw new HttpsError('not-found', 'Pueblo no encontrado.');
      if (decision === 'approved' && muniSnap.get('communityActive') === true) {
        throw new HttpsError('failed-precondition', 'La comunidad ya está activa.');
      }

      tx.update(reqRef, {
        status: decision,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: callerUid,
      });

      if (decision === 'approved') {
        tx.update(muniRef, {
          communityActive: true,
          community: {
            description: '',
            coverImages: [],
            adminUserId: requesterUid,
            profileForm: null,
            activatedAt: FieldValue.serverTimestamp(),
          },
        });
        tx.set(db.doc(`municipalities/${municipalityId}/members/${requesterUid}`), {
          userId: requesterUid,
          role: 'admin',
          joinedAt: FieldValue.serverTimestamp(),
          profileAnswers: {},
          profileCompletedAt: null,
        });
      }
    });

    logger.info('organizer request resolved', { handler, requestId, decision });
    return { ok: true };
  },
);
