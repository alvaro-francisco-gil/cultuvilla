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
import { db } from '../firebase';
import type { UserData, UserDataInput } from '../models/user/UserDataModel';

function mapUserDoc(id: string, data: Record<string, unknown>): UserData & { id: string } {
  return {
    id,
    displayName: data['displayName'] as string,
    email: data['email'] as string,
    birthday: (data['birthday'] as Timestamp).toDate(),
    biography: (data['biography'] as string) ?? null,
    telephone: (data['telephone'] as string) ?? null,
    photoURL: (data['photoURL'] as string) ?? null,
    activeVillageId: (data['activeVillageId'] as string) ?? null,
    personId: (data['personId'] as string) ?? null,
    createdAt: (data['createdAt'] as Timestamp).toDate(),
  };
}

export async function getUserProfile(
  userId: string
): Promise<(UserData & { id: string }) | null> {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  return mapUserDoc(snap.id, snap.data());
}

export async function getAllUsers(): Promise<(UserData & { id: string })[]> {
  const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapUserDoc(d.id, d.data()));
}

export async function createUserProfile(
  userId: string,
  input: UserDataInput
): Promise<void> {
  const docRef = doc(db, 'users', userId);
  await setDoc(docRef, {
    displayName: input.displayName,
    email: input.email,
    birthday: Timestamp.fromDate(input.birthday),
    biography: input.biography ?? null,
    telephone: input.telephone ?? null,
    photoURL: input.photoURL ?? null,
    activeVillageId: input.activeVillageId ?? null,
    personId: input.personId ?? null,
    createdAt: serverTimestamp(),
  });
}

export async function updateUserProfile(
  userId: string,
  data: Partial<Pick<UserData, 'displayName' | 'biography' | 'telephone' | 'photoURL'>>
): Promise<void> {
  const docRef = doc(db, 'users', userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(docRef, data as any);
}

export async function setActiveVillage(
  userId: string,
  villageId: string | null,
): Promise<void> {
  await updateDoc(doc(db, 'users', userId), { activeVillageId: villageId });
}
