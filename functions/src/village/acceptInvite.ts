import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  municipalityDoc,
  municipalityInviteTokenDoc,
  municipalityMemberDoc,
  personsCollection,
  userDoc,
} from '@cultuvilla/shared/firebase/refs/admin';
import { buildPersonData, buildUserData } from '@cultuvilla/shared';
import type { VillageMemberData, PartialDate } from '@cultuvilla/shared';

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
    const userRef = userDoc(db, userId);

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
        const birthdayDate = new Date(profile.birthday);
        if (Number.isNaN(birthdayDate.getTime())) {
          throw new HttpsError('invalid-argument', 'Fecha de nacimiento inválida.');
        }
        // PartialDate aligns with how Person stores birthday — same field name,
        // same shape — so the User and Person docs agree on the format.
        const birthday: PartialDate = {
          year: birthdayDate.getFullYear(),
          month: birthdayDate.getMonth() + 1,
          day: birthdayDate.getDate(),
        };
        // Converter-wrapped ref: createdAt must be a plain Date (sentinels
        // are rejected by the schema). buildUserData defaults createdAt to
        // new Date(), which the converter marshals to a Firestore Timestamp.
        tx.set(
          userRef,
          buildUserData({
            displayName: profile.displayName.trim(),
            email: profile.email,
            birthday,
            biography: null,
            telephone: null,
            photoURL: profile.photoURL ?? null,
            activeMunicipalityId: municipalityId,
          }),
        );
        const personRef = personsCollection(db).doc();
        await personRef.set(
          buildPersonData({
            givenName: profile.displayName.split(' ')[0] ?? profile.displayName,
            photoURL: profile.photoURL ?? null,
            userId,
            createdBy: userId,
          }),
        );
        // tx.update bypasses the converter so a partial { personId } update
        // is fine — but personRef was created outside the tx, so use a
        // post-tx update via the raw doc ref.
        await userDoc(db, userId).update({ personId: personRef.id });
        profileCreated = true;
      } else {
        // merge:true requires a partial doc; converter rejects partial sets,
        // so use the raw doc ref via untyped update for this branch.
        tx.update(userDoc(db, userId), { activeMunicipalityId: municipalityId });
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
