import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, Timestamp, GeoPoint, writeBatch,
} from 'firebase/firestore'
import { getDb } from '../firebase'
import type {
  MunicipalityData,
  MunicipalityDataInput,
  VillageCommunity,
  ActivateCommunityInput,
  BarrioData,
  BarrioDataInput,
  CemeteryData,
  CemeteryDataInput,
} from '../models/municipality'
import type { VillageProfileForm, ProfileFormField } from '../models/municipality/CensoTypes'

// ── Collection refs ──────────────────────────────────────────────────────

function municipalitiesCol() {
  return collection(getDb(), 'municipalities')
}
function barriosCol(municipalityId: string) {
  return collection(getDb(), 'municipalities', municipalityId, 'barrios')
}
function cemeteriesCol(municipalityId: string) {
  return collection(getDb(), 'municipalities', municipalityId, 'cemeteries')
}

// ── Mappers ──────────────────────────────────────────────────────────────

function mapProfileForm(raw: unknown): VillageProfileForm | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { fields?: ProfileFormField[]; updatedAt?: Timestamp }
  if (!Array.isArray(r.fields)) return null
  return {
    fields: r.fields,
    updatedAt: r.updatedAt instanceof Timestamp ? r.updatedAt.toDate() : new Date(),
  }
}

function mapCommunity(raw: unknown): VillageCommunity | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.adminUserId !== 'string') return null
  return {
    description: (r.description as string) ?? '',
    coverImages: Array.isArray(r.coverImages) ? (r.coverImages as string[]) : [],
    adminUserId: r.adminUserId,
    profileForm: mapProfileForm(r.profileForm),
    activatedAt: r.activatedAt instanceof Timestamp ? r.activatedAt.toDate() : new Date(),
  }
}

function mapMunicipalityDoc(id: string, data: Record<string, unknown>): MunicipalityData & { id: string } {
  return {
    id,
    name: data.name as string,
    province: data.province as string,
    comunidadAutonoma: data.comunidadAutonoma as string,
    codigoINE: data.codigoINE as string,
    coordinates: (data.coordinates as GeoPoint | null) ?? null,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    community: mapCommunity(data.community),
    communityActive: (data.communityActive as boolean) ?? false,
  }
}

// ── Municipality CRUD ────────────────────────────────────────────────────

export async function getMunicipality(id: string): Promise<(MunicipalityData & { id: string }) | null> {
  const snap = await getDoc(doc(municipalitiesCol(), id))
  if (!snap.exists()) return null
  return mapMunicipalityDoc(snap.id, snap.data() as Record<string, unknown>)
}

export async function getMunicipalities(): Promise<(MunicipalityData & { id: string })[]> {
  const q = query(municipalitiesCol(), orderBy('name', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => mapMunicipalityDoc(d.id, d.data() as Record<string, unknown>))
}

export async function getActiveCommunities(): Promise<(MunicipalityData & { id: string })[]> {
  const q = query(
    municipalitiesCol(),
    where('communityActive', '==', true),
    orderBy('name', 'asc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => mapMunicipalityDoc(d.id, d.data() as Record<string, unknown>))
}

export async function createMunicipality(input: MunicipalityDataInput): Promise<string> {
  const ref = await addDoc(municipalitiesCol(), {
    name: input.name,
    province: input.province,
    comunidadAutonoma: input.comunidadAutonoma,
    codigoINE: input.codigoINE,
    coordinates: input.coordinates ?? null,
    createdAt: serverTimestamp(),
    community: null,
    communityActive: false,
  })
  return ref.id
}

export async function updateMunicipality(
  id: string,
  data: Partial<Pick<MunicipalityData, 'name' | 'province' | 'comunidadAutonoma' | 'codigoINE' | 'coordinates'>>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(municipalitiesCol(), id), data as any)
}

export async function deleteMunicipality(id: string): Promise<void> {
  await deleteDoc(doc(municipalitiesCol(), id))
}

// ── Community lifecycle ──────────────────────────────────────────────────

/**
 * Activate a community on a municipality. Atomically:
 *  - sets `community` and `communityActive: true` on the municipality doc
 *  - if `coordinates` provided, updates the municipality's coordinates
 *  - creates a /members/{adminUserId} doc with role=admin
 */
export async function activateCommunity(
  municipalityId: string,
  input: ActivateCommunityInput,
): Promise<void> {
  const munRef = doc(municipalitiesCol(), municipalityId)
  const memberRef = doc(getDb(), 'municipalities', municipalityId, 'members', input.adminUserId)

  const community = {
    description: input.description,
    coverImages: input.coverImages ?? [],
    adminUserId: input.adminUserId,
    profileForm: null,
    activatedAt: serverTimestamp(),
  }

  const batch = writeBatch(getDb())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const munUpdate: Record<string, any> = {
    community,
    communityActive: true,
  }
  if (input.coordinates !== undefined) {
    munUpdate.coordinates = input.coordinates
  }
  batch.update(munRef, munUpdate)
  batch.set(memberRef, {
    userId: input.adminUserId,
    role: 'admin',
    joinedAt: serverTimestamp(),
    profileAnswers: {},
    profileCompletedAt: null,
  })
  await batch.commit()
}

export async function updateCommunity(
  municipalityId: string,
  data: Partial<Pick<VillageCommunity, 'description' | 'coverImages' | 'adminUserId'>>,
): Promise<void> {
  const updates: Record<string, unknown> = {}
  if (data.description !== undefined) updates['community.description'] = data.description
  if (data.coverImages !== undefined) updates['community.coverImages'] = data.coverImages
  if (data.adminUserId !== undefined) updates['community.adminUserId'] = data.adminUserId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(municipalitiesCol(), municipalityId), updates as any)
}

export async function deactivateCommunity(municipalityId: string): Promise<void> {
  await updateDoc(doc(municipalitiesCol(), municipalityId), {
    community: null,
    communityActive: false,
  })
}

// ── Barrios ──────────────────────────────────────────────────────────────

export async function getBarrios(municipalityId: string): Promise<(BarrioData & { id: string })[]> {
  const q = query(barriosCol(municipalityId), orderBy('name', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>
    return {
      id: d.id,
      name: data.name as string,
      municipalityId,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    }
  })
}

export async function createBarrio(municipalityId: string, input: BarrioDataInput): Promise<string> {
  const ref = await addDoc(barriosCol(municipalityId), {
    name: input.name,
    municipalityId,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateBarrio(
  municipalityId: string,
  barrioId: string,
  data: Partial<Omit<BarrioData, 'createdAt'>>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(barriosCol(municipalityId), barrioId), data as any)
}

export async function deleteBarrio(municipalityId: string, barrioId: string): Promise<void> {
  await deleteDoc(doc(barriosCol(municipalityId), barrioId))
}

// ── Cemeteries ───────────────────────────────────────────────────────────

export async function getCemeteries(municipalityId: string): Promise<(CemeteryData & { id: string })[]> {
  const q = query(cemeteriesCol(municipalityId), orderBy('name', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>
    return {
      id: d.id,
      name: data.name as string,
      description: (data.description as string | null) ?? null,
      municipalityId,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    }
  })
}

export async function createCemetery(municipalityId: string, input: CemeteryDataInput): Promise<string> {
  const ref = await addDoc(cemeteriesCol(municipalityId), {
    name: input.name,
    description: input.description ?? null,
    municipalityId,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateCemetery(
  municipalityId: string,
  cemeteryId: string,
  data: Partial<Omit<CemeteryData, 'createdAt'>>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(cemeteriesCol(municipalityId), cemeteryId), data as any)
}

export async function deleteCemetery(municipalityId: string, cemeteryId: string): Promise<void> {
  await deleteDoc(doc(cemeteriesCol(municipalityId), cemeteryId))
}

// keep export so other code can call setDoc directly for seed-style work
export { setDoc }
