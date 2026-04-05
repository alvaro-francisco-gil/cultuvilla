import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { UserData, UserDataInput } from '../models/user/UserDataModel';

export async function getUserProfile(
  userId: string
): Promise<(UserData & { id: string }) | null> {
  const docRef = doc(db, 'users', userId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    displayName: data['displayName'],
    email: data['email'],
    birthday: (data['birthday'] as Timestamp).toDate(),
    biography: data['biography'] ?? null,
    telephone: data['telephone'] ?? null,
    photoURL: data['photoURL'] ?? null,
    createdAt: (data['createdAt'] as Timestamp).toDate(),
  };
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
