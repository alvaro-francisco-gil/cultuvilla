import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import type { UserData, UserDataInput } from '../models/user/UserDataModel';

function mapUserDoc(id: string, data: Record<string, unknown>): UserData & { id: string } {
  return {
    id,
    // displayName is denormalized from persons/{id} via the
    // syncPersonDenormalization Cloud Function and can be transiently absent
    // for a user whose person doc hasn't propagated yet — tolerate "".
    displayName: (data['displayName'] as string) ?? '',
    email: data['email'] as string,
    telephone: (data['telephone'] as string) ?? null,
    activeMunicipalityId: (data['activeMunicipalityId'] as string) ?? null,
    personId: (data['personId'] as string) ?? null,
    createdAt: (data['createdAt'] as Timestamp).toDate(),
  };
}

export async function getUserProfile(
  userId: string,
): Promise<(UserData & { id: string }) | null> {
  const snap = await getDoc(doc(getDb(), 'users', userId));
  if (!snap.exists()) return null;
  return mapUserDoc(snap.id, snap.data());
}

export async function getAllUsers(): Promise<(UserData & { id: string })[]> {
  const q = query(collection(getDb(), 'users'), orderBy('displayName', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapUserDoc(d.id, d.data()));
}

/**
 * Input accepted by `createUserProfile` / `patchUserProfile`. `displayName` is
 * intentionally excluded — it's denormalized from persons/{personId} and
 * written exclusively by the syncPersonDenormalization Cloud Function. Client
 * writes are blocked at the firestore.rules layer.
 */
export type ClientUserInput = Omit<UserDataInput, 'displayName'>;

export async function createUserProfile(
  userId: string,
  input: ClientUserInput,
): Promise<void> {
  const docRef = doc(getDb(), 'users', userId);
  // setDoc with merge — the trigger may have already created a partial user
  // doc carrying just displayName when the person was written first.
  await setDoc(
    docRef,
    {
      email: input.email,
      telephone: input.telephone ?? null,
      activeMunicipalityId: input.activeMunicipalityId ?? null,
      personId: input.personId ?? null,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function patchUserProfile(
  userId: string,
  data: Partial<Pick<UserData, 'telephone' | 'activeMunicipalityId' | 'personId'>>,
): Promise<void> {
  await updateDoc(doc(getDb(), 'users', userId), data);
}

export async function setActiveMunicipality(
  userId: string,
  municipalityId: string | null,
): Promise<void> {
  await updateDoc(doc(getDb(), 'users', userId), { activeMunicipalityId: municipalityId });
}
