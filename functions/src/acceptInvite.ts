import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  municipalityDoc,
  municipalityInviteTokenDoc,
  municipalityMemberDoc,
} from '@cultuvilla/shared/firebase/refs/admin';
import type { VillageMemberData } from '@cultuvilla/shared';

const db = getFirestore();

interface InviteProfileInput {
  displayName: string;
  email: string;
  birthday: string; // ISO yyyy-mm-dd
  photoURL?: string | null;
}

interface AcceptInviteData {
  municipalityId?: string;
  tokenId?: string;
  profile?: InviteProfileInput;
}

interface AcceptInviteResult {
  municipalityId: string;
  alreadyMember: boolean;
  profileCreated: boolean;
}

export const acceptInvite = onCall<AcceptInviteData, Promise<AcceptInviteResult>>(
  { region: 'us-central1', cors: true },
  async (request) => {
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

    const { municipalityId, tokenId, profile } = request.data;
    if (!municipalityId || !tokenId) {
      throw new HttpsError('invalid-argument', 'Faltan parámetros.');
    }

    const userId = auth.uid;

    const municipalityRef = municipalityDoc(db, municipalityId);
    const tokenRef = municipalityInviteTokenDoc(db, municipalityId, tokenId);
    const memberRef = municipalityMemberDoc(db, municipalityId, userId);
    // users/ and persons/ collections are not yet migrated to typed refs, so
    // they stay on the raw db.doc() path. Touch points to revisit once those
    // schemas land.
    const userRef = db.doc(`users/${userId}`);

    return db.runTransaction(async (tx) => {
      const [municipalitySnap, tokenSnap, memberSnap, userSnap] = await Promise.all([
        tx.get(municipalityRef),
        tx.get(tokenRef),
        tx.get(memberRef),
        tx.get(userRef),
      ]);

      if (!municipalitySnap.exists) {
        throw new HttpsError('not-found', 'El pueblo no existe.');
      }

      if (!tokenSnap.exists) {
        throw new HttpsError('failed-precondition', 'El enlace de invitación no es válido.');
      }
      // Converter-wrapped: typed InviteTokenData. expiresAt is already a Date.
      const tokenData = tokenSnap.data();
      if (tokenData?.expiresAt && tokenData.expiresAt < new Date()) {
        throw new HttpsError('failed-precondition', 'El enlace de invitación ha expirado.');
      }

      // Profile handling: create if missing and profile data provided.
      let profileCreated = false;
      if (!userSnap.exists) {
        if (!profile) {
          throw new HttpsError(
            'failed-precondition',
            'Falta el perfil del usuario.',
          );
        }
        if (!profile.displayName.trim() || !profile.email || !profile.birthday) {
          throw new HttpsError('invalid-argument', 'Perfil incompleto.');
        }
        const birthday = new Date(profile.birthday);
        if (Number.isNaN(birthday.getTime())) {
          throw new HttpsError('invalid-argument', 'Fecha de nacimiento inválida.');
        }
        tx.set(userRef, {
          displayName: profile.displayName.trim(),
          email: profile.email,
          birthday: Timestamp.fromDate(birthday),
          biography: null,
          telephone: null,
          photoURL: profile.photoURL ?? null,
          activeMunicipalityId: municipalityId,
          createdAt: FieldValue.serverTimestamp(),
        });
        const personRef = db.collection('persons').doc();
        await personRef.set({
          givenName: profile.displayName.split(' ')[0],
          middleNames: [],
          firstSurname: null,
          secondSurname: null,
          nickname: null,
          sex: null,
          birthday: null,
          deathDate: null,
          birthPlace: null,
          burialPlace: null,
          municipalityLinks: [],
          occupationIds: [],
          pendingOccupations: [],
          biography: null,
          photoURL: profile.photoURL ?? null,
          userId: userId,
          createdBy: userId,
          createdAt: FieldValue.serverTimestamp(),
        });
        await db.collection('users').doc(userId).update({ personId: personRef.id });
        profileCreated = true;
      } else {
        tx.set(userRef, { activeMunicipalityId: municipalityId }, { merge: true });
      }

      if (memberSnap.exists) {
        return { municipalityId, alreadyMember: true, profileCreated };
      }

      // Converter rejects FieldValue sentinels on tx.set, so joinedAt is a
      // plain Date (the admin SDK will store it as a Timestamp via the
      // converter's toFirestore step). Schema requires trustedNewsAuthor.
      const newMember: VillageMemberData = {
        userId,
        role: 'user',
        joinedAt: new Date(),
        profileAnswers: {},
        profileCompletedAt: null,
        trustedNewsAuthor: false,
      };
      tx.set(memberRef, newMember);
      // tx.update bypasses the converter, so FieldValue.increment is fine.
      tx.update(tokenRef, {
        usageCount: FieldValue.increment(1),
      });

      return { municipalityId, alreadyMember: false, profileCreated };
    });
  },
);
