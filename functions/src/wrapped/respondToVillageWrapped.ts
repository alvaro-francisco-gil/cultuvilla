import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { adminDoc, municipalityMemberDoc, villageWrappedDoc } from '@cultuvilla/shared/firebase/refs/admin';

const db = getFirestore();

export interface RespondToVillageWrappedData {
  wrappedId?: unknown;
  decision?: unknown;
}

export interface RespondToVillageWrappedResult {
  status: 'published' | 'discarded';
}

/**
 * A village admin releases or bins a draft Wrapped.
 *
 * Two actions, deliberately: the numbers are the numbers, and a Wrapped an
 * admin could edit would not be worth reading. `discarded` is terminal — the
 * scheduler skips it forever, so a pueblo that says no is not asked again
 * every hour.
 */
export const respondToVillageWrapped = onCall<
  RespondToVillageWrappedData,
  Promise<RespondToVillageWrappedResult>
>({ region: 'us-central1', cors: true }, async (request) => {
  const handler = 'respondToVillageWrapped';
  const auth = request.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

  const { wrappedId, decision } = request.data;
  if (typeof wrappedId !== 'string' || (decision !== 'publish' && decision !== 'discard')) {
    throw new HttpsError('invalid-argument', 'Argumentos inválidos.');
  }

  const ref = villageWrappedDoc(db, wrappedId);
  const snap = await ref.get();
  const wrapped = snap.data();
  if (!wrapped) throw new HttpsError('not-found', 'Resumen no encontrado.');

  const [memberSnap, appAdminSnap] = await Promise.all([
    municipalityMemberDoc(db, wrapped.municipalityId, auth.uid).get(),
    adminDoc(db, auth.uid).get(),
  ]);
  if (memberSnap.get('role') !== 'admin' && !appAdminSnap.exists) {
    throw new HttpsError('permission-denied', 'No autorizado.');
  }
  if (wrapped.status !== 'draft') {
    throw new HttpsError('failed-precondition', 'Ese resumen ya está resuelto.');
  }

  const status = decision === 'publish' ? 'published' : 'discarded';
  // A full set rather than a field update: the doc goes back through its
  // converter, so a resolved Wrapped is validated exactly like a built one.
  // autoPublishAt goes null with the decision — the scheduler's due query
  // reads it, and a resolved row must never come back around.
  await ref.set({ ...wrapped, status, autoPublishAt: null });

  logger.info('village wrapped resolved', { handler, wrappedId, status, decidedBy: auth.uid });
  return { status };
});
