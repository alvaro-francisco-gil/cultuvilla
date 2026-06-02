import { doc, getDoc, getDocs, setDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { getDb } from '../firebase';
import { usersCollection, userDoc } from '../firebase/refs/client';
import { buildUserData, type UserData, type UserDataInput } from '../models/user';

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

export async function createUserProfile(
  userId: string,
  input: UserDataInput,
): Promise<void> {
  // setDoc on a typed ref requires a plain Date for createdAt (sentinels are
  // rejected by the schema). buildUserData defaults to new Date().
  await setDoc(userDoc(getDb(), userId), buildUserData(input));
}

export async function patchUserProfile(
  userId: string,
  data: Partial<
    Pick<
      UserData,
      | 'displayName'
      | 'telephone'
      | 'activeMunicipalityId'
      | 'personId'
      | 'birthday'
      | 'biography'
      | 'photoURL'
    >
  >,
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
