import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  municipalityDoc,
  municipalityMembersCollection,
  municipalityMemberDoc,
} from '@cultuvilla/shared/firebase/refs/admin';
import {
  ensureValidFieldShape,
  validateTransition,
  type PrevField,
  type ProfileFormField,
  type UsedValuesByKey,
} from '../helpers/profileFormValidation';

const db = getFirestore();

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
  // Typed members collection: snap.data() returns VillageMemberData.
  const membersSnap = await municipalityMembersCollection(db, municipalityId).get();
  for (const m of membersSnap.docs) {
    const answers = m.data().profileAnswers;
    for (const [k, v] of Object.entries(answers)) {
      // out[k] is typed as Set<...> by UsedValuesByKey's index signature,
      // but runtime returns undefined for first-seen keys (no
      // noUncheckedIndexedAccess in functions/tsconfig.json). Materialize
      // the bucket through a local variable so TypeScript stops complaining
      // about an "unnecessary" undefined check.
      const existing = out[k] as Set<string | number | boolean> | undefined;
      const bucket = existing ?? new Set<string | number | boolean>();
      if (!existing) out[k] = bucket;
      if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === 'string') bucket.add(item);
        }
      } else if (v !== '') {
        bucket.add(v);
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
    const { municipalityId, fields } = request.data;
    if (!municipalityId || !Array.isArray(fields)) {
      throw new HttpsError('invalid-argument', 'Faltan parámetros.');
    }

    fields.forEach(ensureValidFieldShape);

    // Verify the caller is a village admin (or app admin).
    const memberRef = municipalityMemberDoc(db, municipalityId, auth.uid);
    const memberSnap = await memberRef.get();
    const isVillageAdmin = memberSnap.exists && memberSnap.data()?.role === 'admin';
    // admins/ collection has no typed ref yet — existence-check only.
    const adminDocRef = db.doc(`admins/${auth.uid}`);
    const isAppAdmin = (await adminDocRef.get()).exists;
    if (!isVillageAdmin && !isAppAdmin) {
      throw new HttpsError('permission-denied', 'Solo el coordinador puede modificar el censo.');
    }

    const municipalityRef = municipalityDoc(db, municipalityId);
    const municipalitySnap = await municipalityRef.get();
    if (!municipalitySnap.exists) {
      throw new HttpsError('not-found', 'El pueblo no existe.');
    }

    // Converter-wrapped: typed MunicipalityData. profileForm and its fields
    // are already normalized to the schema shape (Date for updatedAt).
    const community = municipalitySnap.data()?.community;
    const prevFields: PrevField[] = community?.profileForm?.fields ?? [];

    const used = await collectUsedValues(municipalityId);
    validateTransition(prevFields, fields, used);

    // .update() bypasses the converter, so FieldValue.serverTimestamp() is
    // fine on the nested updatedAt. The typed-ref overload of update() is
    // resolved through the field/value form here because the MunicipalityData
    // UpdateData<> shape rejects the nullable-field index signature when
    // passing a dotted-path partial as a single arg.
    await municipalityRef.update('community.profileForm', {
      fields,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, fieldCount: fields.length };
  },
);
