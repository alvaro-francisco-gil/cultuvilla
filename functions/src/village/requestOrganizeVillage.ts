import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import {
  municipalityDoc,
  organizerRequestsCollection,
} from '@cultuvilla/shared/firebase/refs/admin';
import type { OrganizerRequestData } from '@cultuvilla/shared';
import { notifyOrganizerRequestCreated } from '../helpers/notifyRequests';

const db = getFirestore();

interface RequestOrganizeVillageData {
  municipalityId?: string;
  description?: string;
  coverImages?: string[];
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

    const { municipalityId, description, coverImages, motivation } = request.data;
    if (!municipalityId) {
      throw new HttpsError('invalid-argument', 'municipalityId requerido.');
    }
    const trimmedDescription = (description ?? '').trim();
    if (!trimmedDescription) {
      throw new HttpsError('invalid-argument', 'La descripción es obligatoria.');
    }
    const coverImageUrls = Array.isArray(coverImages) ? coverImages : [];

    const uid = auth.uid;
    const muniSnap = await municipalityDoc(db, municipalityId).get();
    if (!muniSnap.exists) throw new HttpsError('not-found', 'Pueblo no encontrado.');
    // Converter-wrapped: typed MunicipalityData.
    const muniData = muniSnap.data();
    if (muniData?.communityActive === true) {
      throw new HttpsError('failed-precondition', 'La comunidad ya está activa.');
    }

    const reqsCol = organizerRequestsCollection(db);
    const dup = await reqsCol
      .where('userId', '==', uid)
      .where('municipalityId', '==', municipalityId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (!dup.empty) {
      throw new HttpsError('already-exists', 'Ya tienes una solicitud pendiente para este pueblo.');
    }

    const ref = reqsCol.doc();
    // Converter rejects FieldValue sentinels on set; requestedAt is a plain Date
    // (the admin SDK persists it as a Timestamp via the converter's toFirestore).
    const newRequest: OrganizerRequestData = {
      userId: uid,
      municipalityId,
      requestedAt: new Date(),
      status: 'pending',
      description: trimmedDescription,
      coverImages: coverImageUrls,
      motivation: motivation ?? null,
      reviewedAt: null,
      reviewedBy: null,
    };
    await ref.set(newRequest);

    const municipalityName = muniData?.name ?? municipalityId;
    await notifyOrganizerRequestCreated({
      municipalityId,
      municipalityName,
      requesterUid: uid,
    });

    logger.info('organizer request created', { handler, uid, municipalityId, requestId: ref.id });
    return { ok: true, requestId: ref.id };
  },
);
