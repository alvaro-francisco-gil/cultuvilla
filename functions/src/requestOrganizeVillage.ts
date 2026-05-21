import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { notifyOrganizerRequestCreated } from './helpers/notifyRequests';

const db = admin.firestore();

interface RequestOrganizeVillageData {
  municipalityId?: string;
  motivation?: string | null;
}

interface RequestOrganizeVillageResult {
  ok: true;
  requestId: string;
}

export const requestOrganizeVillage = onCall<
  RequestOrganizeVillageData,
  Promise<RequestOrganizeVillageResult>
>(
  { region: 'us-central1', cors: true },
  async (request) => {
    const handler = 'requestOrganizeVillage';
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

    const { municipalityId, motivation } = request.data ?? {};
    if (!municipalityId) {
      throw new HttpsError('invalid-argument', 'municipalityId requerido.');
    }

    const uid = auth.uid;
    const muniSnap = await db.doc(`municipalities/${municipalityId}`).get();
    if (!muniSnap.exists) throw new HttpsError('not-found', 'Pueblo no encontrado.');
    if (muniSnap.get('communityActive') === true) {
      throw new HttpsError('failed-precondition', 'La comunidad ya está activa.');
    }

    const dup = await db
      .collection('organizerRequests')
      .where('userId', '==', uid)
      .where('municipalityId', '==', municipalityId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (!dup.empty) {
      throw new HttpsError('already-exists', 'Ya tienes una solicitud pendiente para este pueblo.');
    }

    const ref = db.collection('organizerRequests').doc();
    await ref.set({
      userId: uid,
      municipalityId,
      requestedAt: FieldValue.serverTimestamp(),
      status: 'pending',
      motivation: motivation ?? null,
      reviewedAt: null,
      reviewedBy: null,
    });

    const municipalityName = (muniSnap.get('name') as string) ?? municipalityId;
    await notifyOrganizerRequestCreated({
      municipalityId,
      municipalityName,
      requesterUid: uid,
    });

    logger.info('organizer request created', { handler, uid, municipalityId, requestId: ref.id });
    return { ok: true, requestId: ref.id };
  },
);
