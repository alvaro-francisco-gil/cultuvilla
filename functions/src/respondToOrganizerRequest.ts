import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  municipalityDoc,
  municipalityMemberDoc,
  organizerRequestDoc,
} from '@cultuvilla/shared/firebase/refs/admin';
import type { VillageMemberData } from '@cultuvilla/shared';
import { notifyOrganizerRequestResolved } from './helpers/notifyRequests';

const db = getFirestore();

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

    const { requestId, decision } = request.data;
    if (!requestId || (decision !== 'approved' && decision !== 'rejected')) {
      throw new HttpsError('invalid-argument', 'Argumentos inválidos.');
    }

    const callerUid = auth.uid;
    // admins/ collection has no typed ref yet — existence-only check, raw is fine.
    const adminSnap = await db.doc(`admins/${callerUid}`).get();
    if (!adminSnap.exists) {
      throw new HttpsError('permission-denied', 'Sólo superadmin.');
    }

    const reqRef = organizerRequestDoc(db, requestId);
    let requesterUid = '';
    let municipalityId = '';
    let municipalityName = '';

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(reqRef);
      if (!snap.exists) throw new HttpsError('not-found', 'Solicitud no encontrada.');
      // Converter-wrapped: typed OrganizerRequestData.
      const reqData = snap.data();
      if (reqData?.status !== 'pending') {
        throw new HttpsError('failed-precondition', 'La solicitud ya fue resuelta.');
      }

      requesterUid = reqData.userId;
      municipalityId = reqData.municipalityId;
      const muniRef = municipalityDoc(db, municipalityId);
      const muniSnap = await tx.get(muniRef);
      if (!muniSnap.exists) throw new HttpsError('not-found', 'Pueblo no encontrado.');
      // Converter-wrapped: typed MunicipalityData.
      const muniData = muniSnap.data();
      if (decision === 'approved' && muniData?.communityActive === true) {
        throw new HttpsError('failed-precondition', 'La comunidad ya está activa.');
      }
      municipalityName = muniData?.name ?? municipalityId;

      // tx.update bypasses the converter — FieldValue.serverTimestamp() is fine.
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
        // Converter rejects FieldValue sentinels on set; joinedAt is a plain Date.
        const newMember: VillageMemberData = {
          userId: requesterUid,
          role: 'admin',
          joinedAt: new Date(),
          profileAnswers: {},
          profileCompletedAt: null,
          trustedNewsAuthor: false,
        };
        tx.set(municipalityMemberDoc(db, municipalityId, requesterUid), newMember);
      }
    });

    if (requesterUid && municipalityId) {
      await notifyOrganizerRequestResolved({
        municipalityId,
        municipalityName,
        requesterUid,
        decision,
      });
    }

    logger.info('organizer request resolved', { handler, requestId, decision });
    return { ok: true };
  },
);
