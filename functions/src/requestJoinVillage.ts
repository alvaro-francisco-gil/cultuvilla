import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

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

    const { municipalityId, message } = request.data ?? {};
    if (!municipalityId) {
      throw new HttpsError('invalid-argument', 'municipalityId requerido.');
    }

    const uid = auth.uid;
    const muniRef = db.doc(`municipalities/${municipalityId}`);
    const memberRef = db.doc(`municipalities/${municipalityId}/members/${uid}`);
    const reqRef = db.doc(`municipalities/${municipalityId}/joinRequests/${uid}`);

    await db.runTransaction(async (tx) => {
      const [muni, member, existing] = await Promise.all([
        tx.get(muniRef),
        tx.get(memberRef),
        tx.get(reqRef),
      ]);
      if (!muni.exists) throw new HttpsError('not-found', 'Pueblo no encontrado.');
      if (muni.get('communityActive') !== true) {
        throw new HttpsError('failed-precondition', 'La comunidad no está activa.');
      }
      if (member.exists) {
        throw new HttpsError('already-exists', 'Ya eres miembro de este pueblo.');
      }
      if (existing.exists && existing.get('status') === 'pending') {
        throw new HttpsError('already-exists', 'Ya tienes una solicitud pendiente.');
      }

      tx.set(reqRef, {
        userId: uid,
        requestedAt: FieldValue.serverTimestamp(),
        status: 'pending',
        message: message ?? null,
        reviewedAt: null,
        reviewedBy: null,
      });
    });

    logger.info('join request created', { handler, uid, municipalityId });
    return { ok: true };
  },
);
