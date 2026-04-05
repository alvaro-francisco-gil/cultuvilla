import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { PersonaData, PersonaDataInput } from '../models/user/PersonaDataModel';
import { MAX_PERSONAS_PER_USER } from '../models/user/PersonaDataModel';

function personasCol(userId: string) {
  return collection(db, 'users', userId, 'personas');
}

export async function getPersonas(
  userId: string
): Promise<(PersonaData & { id: string })[]> {
  const q = query(personasCol(userId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data['name'],
      birthday: (data['birthday'] as Timestamp).toDate(),
      biography: data['biography'] ?? null,
      photoURL: data['photoURL'] ?? null,
      createdAt: (data['createdAt'] as Timestamp).toDate(),
    };
  });
}

export async function getPersona(
  userId: string,
  personaId: string
): Promise<(PersonaData & { id: string }) | null> {
  const snap = await getDoc(doc(personasCol(userId), personaId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    name: data['name'],
    birthday: (data['birthday'] as Timestamp).toDate(),
    biography: data['biography'] ?? null,
    photoURL: data['photoURL'] ?? null,
    createdAt: (data['createdAt'] as Timestamp).toDate(),
  };
}

export async function createPersona(
  userId: string,
  input: PersonaDataInput
): Promise<string> {
  const existing = await getDocs(personasCol(userId));
  if (existing.size >= MAX_PERSONAS_PER_USER) {
    throw new Error(`Cannot create more than ${MAX_PERSONAS_PER_USER} personas per user.`);
  }
  const newRef = doc(personasCol(userId));
  await setDoc(newRef, {
    name: input.name,
    birthday: Timestamp.fromDate(input.birthday),
    biography: input.biography ?? null,
    photoURL: input.photoURL ?? null,
    createdAt: serverTimestamp(),
  });
  return newRef.id;
}

export async function updatePersona(
  userId: string,
  personaId: string,
  data: Partial<Pick<PersonaData, 'name' | 'biography' | 'photoURL'>>
): Promise<void> {
  const docRef = doc(personasCol(userId), personaId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(docRef, data as any);
}

export async function deletePersona(
  userId: string,
  personaId: string
): Promise<void> {
  await deleteDoc(doc(personasCol(userId), personaId));
}
