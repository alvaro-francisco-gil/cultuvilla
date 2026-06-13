import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import {
  organizationsCollection,
  municipalityMemberDoc,
  adminDoc,
} from '@cultuvilla/shared/firebase/refs/admin';
import type { OrganizationData } from '@cultuvilla/shared';

const db = getFirestore();

interface RequestAyuntamientoData {
  name?: string;
  description?: string | null;
  municipalityId?: string;
}

interface RequestAyuntamientoResult {
  ok: true;
  orgId: string;
}

// An `ayuntamiento` is a singleton per village (business-rules.md §6). Firestore
// rules can't express "no existing ayuntamiento" — they can't query a collection
// at create time — so ayuntamiento creation is denied to clients in
// firestore.rules and owned here, where a transaction enforces the cap. Other
// org types (peña, asociación) are unlimited and stay client-side creates.
export const requestAyuntamiento = onCall<
  RequestAyuntamientoData,
  Promise<RequestAyuntamientoResult>
>(
  { region: 'us-central1', cors: true },
  async (request) => {
    const handler = 'requestAyuntamiento';
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

    const uid = auth.uid;
    const name = request.data.name?.trim();
    const municipalityId = request.data.municipalityId;
    const description = request.data.description ?? null;
    if (!name) throw new HttpsError('invalid-argument', 'Nombre requerido.');
    if (!municipalityId) {
      throw new HttpsError('invalid-argument', 'municipalityId requerido.');
    }

    // Mirror the rules' create gate: village member of that municipality, or app admin.
    const [memberSnap, adminSnap] = await Promise.all([
      municipalityMemberDoc(db, municipalityId, uid).get(),
      adminDoc(db, uid).get(),
    ]);
    if (!memberSnap.exists && !adminSnap.exists) {
      throw new HttpsError('permission-denied', 'No perteneces a este pueblo.');
    }

    const orgsCol = organizationsCollection(db);
    const existingAyuntamientos = orgsCol
      .where('municipalityId', '==', municipalityId)
      .where('type', '==', 'ayuntamiento');
    const newRef = orgsCol.doc();

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(existingAyuntamientos);
      const taken = snap.docs.some((d) =>
        d.data().status === 'pending' || d.data().status === 'approved',
      );
      if (taken) {
        throw new HttpsError(
          'already-exists',
          'Ya existe un ayuntamiento (o una solicitud pendiente) en este pueblo.',
        );
      }
      const data: OrganizationData = {
        name,
        description,
        type: 'ayuntamiento',
        status: 'pending',
        municipalityId,
        requestedBy: uid,
        approvedBy: null,
        createdAt: new Date(),
        decidedAt: null,
      };
      tx.set(newRef, data);
    });

    logger.info('ayuntamiento requested', { handler, uid, municipalityId, orgId: newRef.id });
    return { ok: true, orgId: newRef.id };
  },
);
