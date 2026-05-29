import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { notifyJoinRequestResolved } from '../helpers/notifyRequests';

const db = admin.firestore();

interface RespondToJoinRequestData {
  municipalityId?: string;
  userId?: string;
  decision?: 'approved' | 'rejected';
}

interface RespondToJoinRequestResult {
  ok: true;
}

export const respondToJoinRequest = onCall<
  RespondToJoinRequestData,
  Promise<RespondToJoinRequestResult>
>(
  { region: 'us-central1', cors: true },
  async (request) => {
    const handler = 'respondToJoinRequest';
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

    const { municipalityId, userId, decision } = request.data ?? {};
    if (!municipalityId || !userId || (decision !== 'approved' && decision !== 'rejected')) {
      throw new HttpsError('invalid-argument', 'Argumentos inválidos.');
    }

    const callerUid = auth.uid;
    const muniRef = db.doc(`municipalities/${municipalityId}`);
    const memberRef = db.doc(`municipalities/${municipalityId}/members/${userId}`);
    const reqRef = db.doc(`municipalities/${municipalityId}/joinRequests/${userId}`);
    const callerMemberRef = db.doc(`municipalities/${municipalityId}/members/${callerUid}`);
    const adminRef = db.doc(`admins/${callerUid}`);

    let municipalityName = '';
    await db.runTransaction(async (tx) => {
      const [muniSnap, reqSnap, callerSnap, appAdminSnap] = await Promise.all([
        tx.get(muniRef),
        tx.get(reqRef),
        tx.get(callerMemberRef),
        tx.get(adminRef),
      ]);

      const isVillageAdmin = callerSnap.exists && callerSnap.get('role') === 'admin';
      const isCommunityAdmin = muniSnap.get('community.adminUserId') === callerUid;
      const isAppAdmin = appAdminSnap.exists;
      if (!(isVillageAdmin || isCommunityAdmin || isAppAdmin)) {
        throw new HttpsError('permission-denied', 'No autorizado.');
      }
      if (!reqSnap.exists) throw new HttpsError('not-found', 'Solicitud no encontrada.');
      if (reqSnap.get('status') !== 'pending') {
        throw new HttpsError('failed-precondition', 'La solicitud ya fue resuelta.');
      }
      municipalityName = (muniSnap.get('name') as string) ?? municipalityId;

      tx.update(reqRef, {
        status: decision,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: callerUid,
      });

      if (decision === 'approved') {
        tx.set(memberRef, {
          userId,
          role: 'user',
          joinedAt: FieldValue.serverTimestamp(),
          profileAnswers: {},
          profileCompletedAt: null,
        });
      }
    });

    await notifyJoinRequestResolved({
      municipalityId,
      municipalityName,
      requesterUid: userId,
      decision,
    });

    logger.info('join request resolved', { handler, municipalityId, userId, decision });
    return { ok: true };
  },
);
