// packages/shared/src/services/inviteTokenService.ts
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  increment,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDb, getFirebaseFunctions } from '../firebase';
import {
  municipalityInviteTokensCollection,
  municipalityInviteTokenDoc,
} from '../firebase/refs/client';
import type { InviteTokenData } from '../models/municipality/InviteTokenDataModel';
import { isTokenExpired } from '../models/municipality/InviteTokenDataModel';

export async function createInviteToken(
  municipalityId: string,
  expiresAt?: Date | null,
): Promise<string> {
  const newRef = doc(municipalityInviteTokensCollection(getDb(), municipalityId));
  const data: InviteTokenData = {
    createdAt: new Date(),
    expiresAt: expiresAt ?? null,
    usageCount: 0,
  };
  await setDoc(newRef, data);
  return newRef.id;
}

export async function validateInviteToken(
  municipalityId: string,
  tokenId: string,
): Promise<boolean> {
  const snap = await getDoc(municipalityInviteTokenDoc(getDb(), municipalityId, tokenId));
  if (!snap.exists()) return false;
  return !isTokenExpired(snap.data());
}

export async function consumeInviteToken(
  municipalityId: string,
  tokenId: string,
): Promise<void> {
  // updateDoc bypasses the converter; use untyped doc for the increment.
  await updateDoc(doc(getDb(), 'municipalities', municipalityId, 'inviteTokens', tokenId), {
    usageCount: increment(1),
  });
}

export async function getInviteTokens(
  municipalityId: string,
): Promise<(InviteTokenData & { id: string })[]> {
  const snap = await getDocs(municipalityInviteTokensCollection(getDb(), municipalityId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteInviteToken(
  municipalityId: string,
  tokenId: string,
): Promise<void> {
  await deleteDoc(municipalityInviteTokenDoc(getDb(), municipalityId, tokenId));
}

export interface AcceptInviteProfile {
  displayName: string;
  email: string;
  birthday: Date;
  photoURL?: string | null;
}

export interface AcceptInviteResult {
  municipalityId: string;
  alreadyMember: boolean;
  profileCreated: boolean;
}

export async function acceptInvite(
  municipalityId: string,
  tokenId: string,
  profile?: AcceptInviteProfile,
): Promise<AcceptInviteResult> {
  const callable = httpsCallable<
    {
      municipalityId: string;
      tokenId: string;
      profile?: {
        displayName: string;
        email: string;
        birthday: string;
        photoURL: string | null;
      };
    },
    AcceptInviteResult
  >(getFirebaseFunctions(), 'acceptInvite');

  const payload = profile
    ? {
        municipalityId,
        tokenId,
        profile: {
          displayName: profile.displayName,
          email: profile.email,
          birthday: profile.birthday.toISOString().slice(0, 10),
          photoURL: profile.photoURL ?? null,
        },
      }
    : { municipalityId, tokenId };

  const result = await callable(payload);
  return result.data;
}
