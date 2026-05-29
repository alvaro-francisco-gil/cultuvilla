import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  municipalityDoc,
  municipalityJoinRequestDoc,
  municipalityMemberDoc,
} from '@cultuvilla/shared/firebase/refs/admin';
import type { VillageMemberData } from '@cultuvilla/shared';
import { notifyJoinRequestResolved } from './helpers/notifyRequests';

const db = getFirestore();

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

    const { municipalityId, userId, decision } = request.data;
    if (!municipalityId || !userId || (decision !== 'approved' && decision !== 'rejected')) {
      throw new HttpsError('invalid-argument', 'Argumentos inválidos.');
    }

    const callerUid = auth.uid;
    const muniRef = municipalityDoc(db, municipalityId);
    const memberRef = municipalityMemberDoc(db, municipalityId, userId);
    const reqRef = municipalityJoinRequestDoc(db, municipalityId, userId);
    const callerMemberRef = municipalityMemberDoc(db, municipalityId, callerUid);
    // admins/ collection has no typed ref yet — it's only ever existence-
    // checked here, so raw access is fine.
    const adminRef = db.doc(`admins/${callerUid}`);

    let municipalityName = '';
    await db.runTransaction(async (tx) => {
      const [muniSnap, reqSnap, callerSnap, appAdminSnap] = await Promise.all([
        tx.get(muniRef),
        tx.get(reqRef),
        tx.get(callerMemberRef),
        tx.get(adminRef),
      ]);

      // Converter-wrapped reads: typed snapshots.
      const callerData = callerSnap.data();
      const isVillageAdmin = callerSnap.exists && callerData?.role === 'admin';
      const muniData = muniSnap.data();
      const isCommunityAdmin = muniData?.community?.adminUserId === callerUid;
      const isAppAdmin = appAdminSnap.exists;
      if (!(isVillageAdmin || isCommunityAdmin || isAppAdmin)) {
        throw new HttpsError('permission-denied', 'No autorizado.');
      }
      if (!reqSnap.exists) throw new HttpsError('not-found', 'Solicitud no encontrada.');
      const reqData = reqSnap.data();
      if (reqData?.status !== 'pending') {
        throw new HttpsError('failed-precondition', 'La solicitud ya fue resuelta.');
      }
      municipalityName = muniData?.name ?? municipalityId;

      // tx.update bypasses the converter, so FieldValue.serverTimestamp() works.
      tx.update(reqRef, {
        status: decision,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: callerUid,
      });

      if (decision === 'approved') {
        // Converter rejects FieldValue sentinels; joinedAt is a plain Date.
        // trustedNewsAuthor is required by VillageMemberDataSchema.
        const newMember: VillageMemberData = {
          userId,
          role: 'user',
          joinedAt: new Date(),
          profileAnswers: {},
          profileCompletedAt: null,
          trustedNewsAuthor: false,
        };
        tx.set(memberRef, newMember);
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
