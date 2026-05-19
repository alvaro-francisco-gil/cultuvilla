import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { getDb } from '../firebase'
import type { PersonData, PersonDataInput, PartialDate, MunicipalityLink, BurialPlace } from '../models/person'

function personsCol() {
  return collection(getDb(), 'persons')
}

function toPartialDate(val: unknown): PartialDate | null {
  if (!val || typeof val !== 'object') return null
  const v = val as Record<string, unknown>
  return {
    year: typeof v.year === 'number' ? v.year : null,
    month: typeof v.month === 'number' ? v.month : null,
    day: typeof v.day === 'number' ? v.day : null,
  }
}

function toMunicipalityLink(val: unknown): MunicipalityLink | null {
  if (!val || typeof val !== 'object') return null
  const v = val as Record<string, unknown>
  if (typeof v.municipalityId !== 'string') return null
  return {
    municipalityId: v.municipalityId,
    barrioId: typeof v.barrioId === 'string' ? v.barrioId : null,
  }
}

function toBurialPlace(val: unknown): BurialPlace | null {
  if (!val || typeof val !== 'object') return null
  const v = val as Record<string, unknown>
  if (typeof v.municipalityId !== 'string' || typeof v.cemeteryId !== 'string') return null
  return { municipalityId: v.municipalityId, cemeteryId: v.cemeteryId }
}

function fromDoc(id: string, data: Record<string, unknown>): PersonData & { id: string } {
  return {
    id,
    givenName: data.givenName as string,
    middleNames: Array.isArray(data.middleNames) ? (data.middleNames as string[]) : [],
    firstSurname: (data.firstSurname as string | null) ?? null,
    secondSurname: (data.secondSurname as string | null) ?? null,
    nickname: (data.nickname as string | null) ?? null,
    sex: (data.sex as PersonData['sex']) ?? null,
    birthday: toPartialDate(data.birthday),
    deathDate: toPartialDate(data.deathDate),
    birthPlace: toMunicipalityLink(data.birthPlace),
    burialPlace: toBurialPlace(data.burialPlace),
    municipalityLinks: Array.isArray(data.municipalityLinks)
      ? (data.municipalityLinks as unknown[]).map(toMunicipalityLink).filter((v): v is MunicipalityLink => v !== null)
      : [],
    occupationIds: Array.isArray(data.occupationIds) ? (data.occupationIds as string[]) : [],
    pendingOccupations: Array.isArray(data.pendingOccupations) ? (data.pendingOccupations as string[]) : [],
    biography: (data.biography as string | null) ?? null,
    photoURL: (data.photoURL as string | null) ?? null,
    userId: (data.userId as string | null) ?? null,
    createdBy: data.createdBy as string,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
  }
}

export async function getPerson(personId: string): Promise<(PersonData & { id: string }) | null> {
  const snap = await getDoc(doc(personsCol(), personId))
  if (!snap.exists()) return null
  return fromDoc(snap.id, snap.data() as Record<string, unknown>)
}

export async function getPersonsByCreator(userId: string): Promise<(PersonData & { id: string })[]> {
  const q = query(personsCol(), where('createdBy', '==', userId), orderBy('createdAt', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => fromDoc(d.id, d.data() as Record<string, unknown>))
}

export async function getPersonByUserId(userId: string): Promise<(PersonData & { id: string }) | null> {
  const q = query(personsCol(), where('userId', '==', userId))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return fromDoc(d.id, d.data() as Record<string, unknown>)
}

export async function createPerson(input: PersonDataInput): Promise<string> {
  const ref = await addDoc(personsCol(), {
    givenName: input.givenName,
    middleNames: input.middleNames ?? [],
    firstSurname: input.firstSurname ?? null,
    secondSurname: input.secondSurname ?? null,
    nickname: input.nickname ?? null,
    sex: input.sex ?? null,
    birthday: input.birthday ?? null,
    deathDate: input.deathDate ?? null,
    birthPlace: input.birthPlace ?? null,
    burialPlace: input.burialPlace ?? null,
    municipalityLinks: input.municipalityLinks ?? [],
    occupationIds: input.occupationIds ?? [],
    pendingOccupations: input.pendingOccupations ?? [],
    biography: input.biography ?? null,
    photoURL: input.photoURL ?? null,
    userId: input.userId ?? null,
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updatePerson(
  personId: string,
  data: Partial<Omit<PersonData, 'createdBy' | 'createdAt'>>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(personsCol(), personId), data as any)
}

export async function deletePerson(personId: string): Promise<void> {
  await deleteDoc(doc(personsCol(), personId))
}
