import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import snapshot from './snapshot.json';

/**
 * Serve the business registry to the founders' panel.
 *
 * The data is generated from `project/**` at build time and bundled into the
 * functions deploy, which is NOT publicly served — that is the whole point.
 * An earlier version of this panel lived inside the mobile app, where the route
 * guard hid the screen but the JSON still shipped in the public web bundle.
 * Here nothing reaches a browser until the caller has proved it is an app admin.
 */
const handler = 'getBusinessSnapshot';

export async function runGetBusinessSnapshot(uid: string | null): Promise<unknown> {
  if (!uid) throw new HttpsError('unauthenticated', 'Hay que iniciar sesión.');
  const adminDoc = await getFirestore().collection('admins').doc(uid).get();
  if (!adminDoc.exists) {
    // Deliberately the same shape for "not signed in" and "not an admin" from
    // the panel's point of view, so the panel has one error path to render.
    throw new HttpsError('permission-denied', 'Esta herramienta es solo para el equipo.');
  }
  return snapshot;
}

export const getBusinessSnapshot = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = request.auth?.uid ?? null;
  return { handler, snapshot: await runGetBusinessSnapshot(uid) };
});
