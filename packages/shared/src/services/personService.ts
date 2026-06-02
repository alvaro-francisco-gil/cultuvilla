import { doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { getDb } from '../firebase';
import { personsCollection, personDoc } from '../firebase/refs/client';
import { buildPersonData, type PersonData, type PersonDataInput } from '../models/person';

export async function getPerson(personId: string): Promise<(PersonData & { id: string }) | null> {
  const snap = await getDoc(personDoc(getDb(), personId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getPersonsByCreator(
  userId: string,
): Promise<(PersonData & { id: string })[]> {
  const q = query(
    personsCollection(getDb()),
    where('createdBy', '==', userId),
    orderBy('createdAt', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getPersonByUserId(
  userId: string,
): Promise<(PersonData & { id: string }) | null> {
  const q = query(personsCollection(getDb()), where('userId', '==', userId), limit(1));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))[0] ?? null;
}

export async function createPerson(input: PersonDataInput): Promise<string> {
  // addDoc routes through the typed converter, so createdAt must be a plain
  // Date (serverTimestamp sentinels are rejected by the schema). The converter
  // re-marshals the Date to a Firestore Timestamp on write.
  const ref = await addDoc(personsCollection(getDb()), buildPersonData(input));
  return ref.id;
}

export async function updatePerson(
  personId: string,
  data: Partial<Omit<PersonData, 'createdBy' | 'createdAt'>>,
): Promise<void> {
  // updateDoc bypasses the converter, so partial-update payloads (and any
  // FieldValue sentinels callers might pass through Partial) go on the raw
  // doc ref rather than the typed one.
  await updateDoc(doc(getDb(), 'persons', personId), data);
}

export async function deletePerson(personId: string): Promise<void> {
  await deleteDoc(personDoc(getDb(), personId));
}
