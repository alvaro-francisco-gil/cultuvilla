import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { municipalityMemberDoc } from '@cultuvilla/shared/firebase/refs/admin';

const db = admin.firestore();

interface SetTrustedNewsAuthorData {
  municipalityId?: string;
  userId?: string;
  trusted?: boolean;
}

interface SetTrustedNewsAuthorResult {
  ok: true;
}

export const setTrustedNewsAuthor = onCall<SetTrustedNewsAuthorData, Promise<SetTrustedNewsAuthorResult>>(
  { region: 'us-central1', cors: true },
  async (request) => {
    const handler = 'setTrustedNewsAuthor';
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

    const { municipalityId, userId, trusted } = request.data;
    if (!municipalityId || !userId || typeof trusted !== 'boolean') {
      throw new HttpsError('invalid-argument', 'Argumentos inválidos.');
    }

    const callerMemberRef = municipalityMemberDoc(db, municipalityId, auth.uid);
    const appAdminRef = db.doc(`admins/${auth.uid}`);
    const targetMemberRef = municipalityMemberDoc(db, municipalityId, userId);

    const [callerMemberSnap, appAdminSnap, targetMemberSnap] = await Promise.all([
      callerMemberRef.get(),
      appAdminRef.get(),
      targetMemberRef.get(),
    ]);

    const isVillageAdmin =
      callerMemberSnap.exists && callerMemberSnap.data()?.role === 'admin';
    const isAppAdmin = appAdminSnap.exists;

    if (!isVillageAdmin && !isAppAdmin) {
      throw new HttpsError('permission-denied', 'No autorizado.');
    }

    if (!targetMemberSnap.exists) {
      throw new HttpsError('not-found', 'El usuario no es miembro de este municipio.');
    }

    // update bypasses the converter; partial payload goes on the raw doc ref.
    await db.doc(`municipalities/${municipalityId}/members/${userId}`).update({
      trustedNewsAuthor: trusted,
    });

    logger.info('toggled trustedNewsAuthor', { handler, municipalityId, userId, trusted });
    return { ok: true };
  },
);
