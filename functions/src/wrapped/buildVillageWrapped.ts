import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { adminDoc, municipalityDoc, municipalityMemberDoc } from '@cultuvilla/shared/firebase/refs/admin';
import { buildAndStoreWrapped } from './storeWrapped';

const db = getFirestore();

export interface BuildVillageWrappedData {
  municipalityId?: unknown;
  blockId?: unknown;
  year?: unknown;
}

export interface BuildVillageWrappedResult {
  wrappedId: string;
  status: string;
}

/**
 * Recompute one block's Wrapped on demand.
 *
 * The scheduler builds every Wrapped on its own, so this exists for the two
 * cases the timer cannot serve: an admin who fixed the block's dates (or an
 * event) after the fact and wants the numbers redone, and replaying a past
 * year. It is admin-gated because rendering costs ~20s and ~140 image fetches.
 */
export const buildVillageWrapped = onCall<BuildVillageWrappedData, Promise<BuildVillageWrappedResult>>(
  { region: 'us-central1', cors: true, memory: '1GiB', timeoutSeconds: 300 },
  async (request) => {
    const handler = 'buildVillageWrapped';
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

    const { municipalityId, blockId, year } = request.data;
    if (typeof municipalityId !== 'string' || typeof blockId !== 'string' || typeof year !== 'number') {
      throw new HttpsError('invalid-argument', 'Argumentos inválidos.');
    }

    const [memberSnap, appAdminSnap, muniSnap] = await Promise.all([
      municipalityMemberDoc(db, municipalityId, auth.uid).get(),
      adminDoc(db, auth.uid).get(),
      municipalityDoc(db, municipalityId).get(),
    ]);
    if (memberSnap.get('role') !== 'admin' && !appAdminSnap.exists) {
      throw new HttpsError('permission-denied', 'No autorizado.');
    }
    if (!muniSnap.exists) throw new HttpsError('not-found', 'Pueblo no encontrado.');

    const block = muniSnap.data()?.community?.fiestas.find((b) => b.id === blockId);
    if (!block) throw new HttpsError('not-found', 'Ese bloque de fiestas no existe.');

    const built = await buildAndStoreWrapped(db, municipalityId, block, year);
    if (!built) {
      throw new HttpsError('failed-precondition', 'Confirma las fechas exactas de ese año antes de generar el resumen.');
    }

    logger.info('village wrapped rebuilt on request', {
      handler,
      municipalityId,
      wrappedId: built.id,
      year,
      blockId,
      requestedBy: auth.uid,
    });
    return { wrappedId: built.id, status: built.data.status };
  },
);
