import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDb, getFirebaseFunctions } from '../firebase';
import type { InviteTokenData } from '../models/municipality/InviteTokenDataModel';
import { isTokenExpired } from '../models/municipality/InviteTokenDataModel';

function tokensCol(municipalityId: string) {
  return collection(getDb(), 'municipalities', municipalityId, 'inviteTokens');
}

function mapTokenDoc(d: { id: string; data: () => Record<string, unknown> }): InviteTokenData & { id: string } {
  const data = d.data();
  const expiresAtRaw = data['expiresAt'];
  return {
    id: d.id,
    createdAt: (data['createdAt'] as Timestamp).toDate(),
    expiresAt: expiresAtRaw ? (expiresAtRaw as Timestamp).toDate() : null,
    usageCount: (data['usageCount'] as number) ?? 0,
  };
}

export async function createInviteToken(
  municipalityId: string,
  expiresAt?: Date | null
): Promise<string> {
  const newRef = doc(tokensCol(municipalityId));
  await setDoc(newRef, {
    createdAt: serverTimestamp(),
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
    usageCount: 0,
  });
  return newRef.id;
}

export async function validateInviteToken(
  municipalityId: string,
  tokenId: string
): Promise<boolean> {
  const snap = await getDoc(doc(tokensCol(municipalityId), tokenId));
  if (!snap.exists()) return false;
  const token = mapTokenDoc(snap as Parameters<typeof mapTokenDoc>[0]);
  return !isTokenExpired(token);
}

export async function consumeInviteToken(
  municipalityId: string,
  tokenId: string
): Promise<void> {
  await updateDoc(doc(tokensCol(municipalityId), tokenId), {
    usageCount: increment(1),
  });
}

export async function getInviteTokens(
  municipalityId: string
): Promise<(InviteTokenData & { id: string })[]> {
  const snap = await getDocs(tokensCol(municipalityId));
  return snap.docs.map((d) => mapTokenDoc(d as Parameters<typeof mapTokenDoc>[0]));
}

export async function deleteInviteToken(
  municipalityId: string,
  tokenId: string
): Promise<void> {
  await deleteDoc(doc(tokensCol(municipalityId), tokenId));
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
