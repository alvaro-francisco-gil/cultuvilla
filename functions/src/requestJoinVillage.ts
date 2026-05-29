import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import {
  municipalityDoc,
  municipalityJoinRequestDoc,
  municipalityMemberDoc,
} from '@cultuvilla/shared/firebase/refs/admin';
import type { JoinRequestData } from '@cultuvilla/shared';
import {
  listVillageAdminRecipients,
  notifyJoinRequestCreated,
} from './helpers/notifyRequests';

const db = getFirestore();

interface RequestJoinVillageData {
  municipalityId?: string;
  message?: string | null;
}

interface RequestJoinVillageResult {
  ok: true;
}

export const requestJoinVillage = onCall<RequestJoinVillageData, Promise<RequestJoinVillageResult>>(
  { region: 'us-central1', cors: true },
  async (request) => {
    const handler = 'requestJoinVillage';
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

    const { municipalityId, message } = request.data;
    if (!municipalityId) {
      throw new HttpsError('invalid-argument', 'municipalityId requerido.');
    }

    const uid = auth.uid;
    const muniRef = municipalityDoc(db, municipalityId);
    const memberRef = municipalityMemberDoc(db, municipalityId, uid);
    const reqRef = municipalityJoinRequestDoc(db, municipalityId, uid);

    let municipalityName = '';
    await db.runTransaction(async (tx) => {
      const [muni, member, existing] = await Promise.all([
        tx.get(muniRef),
        tx.get(memberRef),
        tx.get(reqRef),
      ]);
      if (!muni.exists) throw new HttpsError('not-found', 'Pueblo no encontrado.');
      // Converter-wrapped: typed MunicipalityData.
      const muniData = muni.data();
      if (muniData?.communityActive !== true) {
        throw new HttpsError('failed-precondition', 'La comunidad no está activa.');
      }
      if (member.exists) {
        throw new HttpsError('already-exists', 'Ya eres miembro de este pueblo.');
      }
      // Converter-wrapped: typed JoinRequestData.
      const existingData = existing.data();
      if (existing.exists && existingData?.status === 'pending') {
        throw new HttpsError('already-exists', 'Ya tienes una solicitud pendiente.');
      }
      municipalityName = muniData.name;

      // Converter rejects FieldValue sentinels on tx.set, so requestedAt is a
      // plain Date (the admin SDK will persist it as a Timestamp via the
      // converter's toFirestore step).
      const newRequest: JoinRequestData = {
        userId: uid,
        requestedAt: new Date(),
        status: 'pending',
        message: message ?? null,
        reviewedAt: null,
        reviewedBy: null,
      };
      tx.set(reqRef, newRequest);
    });

    const recipientUserIds = await listVillageAdminRecipients({
      municipalityId,
      excludeUid: uid,
    });
    await notifyJoinRequestCreated({
      municipalityId,
      municipalityName,
      requesterUid: uid,
      recipientUserIds,
    });

    logger.info('join request created', { handler, uid, municipalityId });
    return { ok: true };
  },
);
