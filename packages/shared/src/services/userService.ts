import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import { usersCollection, userDoc } from '../firebase/refs/client';
import type { UserData, UserDataInput } from '../models/user';

export async function getUserProfile(
  userId: string,
): Promise<(UserData & { id: string }) | null> {
  const snap = await getDoc(userDoc(getDb(), userId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllUsers(): Promise<(UserData & { id: string })[]> {
  const q = query(usersCollection(getDb()), orderBy('displayName', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
  // setDoc with merge — the syncPersonDenormalization trigger may have already
  // created a partial user doc carrying just displayName when the person was
  // written first. Bypass the typed converter (which would write a full
  // schema-shaped object, including displayName: '' that firestore.rules
  // blocks for clients) by using a raw doc ref for this merge payload.
  // typed-refs: allowed
  const docRef = doc(getDb(), 'users', userId);
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
  // displayName intentionally excluded — denormalized by Cloud Function.
  // birthday/biography/photoURL live on the linked person, not here.
  data: Partial<Pick<UserData, 'telephone' | 'activeMunicipalityId' | 'personId'>>,
): Promise<void> {
  // updateDoc bypasses the converter, so partial-update payloads (and any
  // FieldValue sentinels callers might pass through Partial) go on the raw
  // doc ref rather than the typed one.
  await updateDoc(doc(getDb(), 'users', userId), data);
}

export async function setActiveMunicipality(
  userId: string,
  municipalityId: string | null,
): Promise<void> {
  await updateDoc(doc(getDb(), 'users', userId), { activeMunicipalityId: municipalityId });
}
