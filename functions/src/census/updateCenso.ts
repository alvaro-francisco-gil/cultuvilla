import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  ensureValidFieldShape,
  validateTransition,
  type PrevField,
  type ProfileFormField,
  type UsedValuesByKey,
} from './helpers/profileFormValidation';

const db = admin.firestore();

interface UpdateCensoData {
  municipalityId?: string;
  fields?: ProfileFormField[];
}

interface UpdateCensoResult {
  ok: true;
  fieldCount: number;
}

async function collectUsedValues(municipalityId: string): Promise<UsedValuesByKey> {
  const out: UsedValuesByKey = {};
  const membersSnap = await db.collection(`municipalities/${municipalityId}/members`).get();
  for (const m of membersSnap.docs) {
    const answers = (m.data().profileAnswers ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(answers)) {
      if (!out[k]) out[k] = new Set();
      if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === 'string') out[k].add(item);
        }
      } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        if (v !== '' && v !== null && v !== undefined) out[k].add(v);
      }
    }
  }
  return out;
}

export const updateCenso = onCall<UpdateCensoData, Promise<UpdateCensoResult>>(
  { region: 'us-central1', cors: true },
  async (request) => {
    const auth = request.auth;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    const { municipalityId, fields } = request.data ?? {};
    if (!municipalityId || !Array.isArray(fields)) {
      throw new HttpsError('invalid-argument', 'Faltan parámetros.');
    }

    fields.forEach(ensureValidFieldShape);

    // Verify the caller is a village admin (or app admin).
    const memberRef = db.doc(`municipalities/${municipalityId}/members/${auth.uid}`);
    const memberSnap = await memberRef.get();
    const isVillageAdmin = memberSnap.exists && memberSnap.data()?.role === 'admin';
    const adminDocRef = db.doc(`admins/${auth.uid}`);
    const isAppAdmin = (await adminDocRef.get()).exists;
    if (!isVillageAdmin && !isAppAdmin) {
      throw new HttpsError('permission-denied', 'Solo el coordinador puede modificar el censo.');
    }

    const municipalityRef = db.doc(`municipalities/${municipalityId}`);
    const municipalitySnap = await municipalityRef.get();
    if (!municipalitySnap.exists) {
      throw new HttpsError('not-found', 'El pueblo no existe.');
    }

    const community = municipalitySnap.data()?.community as
      | { profileForm?: { fields?: PrevField[] } | null }
      | null
      | undefined;
    const prevFields: PrevField[] = community?.profileForm?.fields ?? [];

    const used = await collectUsedValues(municipalityId);
    validateTransition(prevFields, fields, used);

    await municipalityRef.update({
      'community.profileForm': {
        fields,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    });

    return { ok: true, fieldCount: fields.length };
  },
);
