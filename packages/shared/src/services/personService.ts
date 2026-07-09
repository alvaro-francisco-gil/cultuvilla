import {
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import { personsCollection, personDoc } from '../firebase/refs/client';
import {
  buildPersonData,
  buildDisplayName,
  buildResidenceLinks,
  type PersonData,
  type PersonDataInput,
} from '../models/person';

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

/**
 * Set an account-holder's residence barrio within a village. Residence is
 * single-source-of-truth on the person's `municipalityLinks`, so this upserts
 * the entry for `municipalityId` directly (the caller owns their person doc).
 * `barrioId` null = "Todo el pueblo" (whole village). Written via
 * `buildResidenceLinks`, the single constructor of the exact
 * `{ municipalityId, barrioId }` shape `getPersonsByBarrio` matches on. No-op
 * when the user has no linked person.
 */
export async function updateResidenceBarrio(
  userId: string,
  municipalityId: string,
  barrioId: string | null,
): Promise<void> {
  const person = await getPersonByUserId(userId);
  if (!person) return;
  const others = person.municipalityLinks.filter((l) => l.municipalityId !== municipalityId);
  await updatePerson(person.id, {
    municipalityLinks: [...others, ...buildResidenceLinks(municipalityId, barrioId)],
  });
}

/** People linked to a given barrio (residence link in `municipalityLinks`). */
export async function getPersonsByBarrio(
  municipalityId: string,
  barrioId: string,
): Promise<(PersonData & { id: string })[]> {
  const q = query(
    personsCollection(getDb()),
    where('municipalityLinks', 'array-contains', { municipalityId, barrioId }),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => buildDisplayName(a).localeCompare(buildDisplayName(b)));
}

/**
 * Count of people whose residence is a given barrio. Uses a server-side count
 * aggregate over the same `array-contains { municipalityId, barrioId }` query as
 * `getPersonsByBarrio`, so it never ships the person docs. Excludes whole-village
 * members (`barrioId: null`), who match no specific barrio.
 */
export async function getBarrioResidentCount(
  municipalityId: string,
  barrioId: string,
): Promise<number> {
  const q = query(
    personsCollection(getDb()),
    where('municipalityLinks', 'array-contains', { municipalityId, barrioId }),
  );
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

/**
 * People buried in a given place (cemetery), via `burialPlace.placeId`.
 * Intentionally not scoped by municipality: `placeId` is a Firestore
 * auto-id from `/municipalities/{id}/places/`, so it is globally unique
 * and a bare `placeId` match cannot collide across villages.
 */
export async function getPersonsByBurialPlace(
  placeId: string,
): Promise<(PersonData & { id: string })[]> {
  const q = query(personsCollection(getDb()), where('burialPlace.placeId', '==', placeId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => buildDisplayName(a).localeCompare(buildDisplayName(b)));
}
