// packages/shared/src/services/municipalityService.ts
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit as firestoreLimit,
  serverTimestamp,
  writeBatch,
  type UpdateData,
  type DocumentData,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import {
  municipalitiesCollection,
  municipalityDoc,
  municipalityBarriosCollection,
  municipalityBarrioDoc,
  municipalityCemeteriesCollection,
  municipalityCemeteryDoc,
  municipalityMemberDoc,
} from '../firebase/refs/client';
import type {
  MunicipalityData,
  MunicipalityDataInput,
  VillageCommunity,
  ActivateCommunityInput,
  BarrioData,
  BarrioDataInput,
  CemeteryData,
  CemeteryDataInput,
} from '../models/municipality';
import { municipalitySearchKey } from '../models/municipality/MunicipalityDataModel';

// ── Municipality CRUD ────────────────────────────────────────────────────

export async function getMunicipality(id: string): Promise<(MunicipalityData & { id: string }) | null> {
  const snap = await getDoc(municipalityDoc(getDb(), id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getMunicipalities(): Promise<(MunicipalityData & { id: string })[]> {
  const q = query(municipalitiesCollection(getDb()), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Prefix-search municipalities by name. Matches against the indexed
 * `nameLower` field (accent-stripped, lowercased) so "avila" finds "Ávila"
 * and "castell" finds "Castellón".
 *
 * An empty query returns the first `limit` municipalities alphabetically.
 *
 * Cost: O(limit) doc reads regardless of collection size — safe to call
 * on every keystroke (debounce in caller for UX).
 */
export async function searchMunicipalities(
  searchQuery: string,
  limit = 50,
): Promise<(MunicipalityData & { id: string })[]> {
  const key = municipalitySearchKey(searchQuery.trim());
  if (key.length === 0) {
    const q = query(
      municipalitiesCollection(getDb()),
      orderBy('nameLower', 'asc'),
      firestoreLimit(limit),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  // Firestore prefix search: nameLower >= key AND nameLower < key + ''
  // ( is in a Unicode private-use area, sorting after most printable chars).
  const q = query(
    municipalitiesCollection(getDb()),
    orderBy('nameLower', 'asc'),
    where('nameLower', '>=', key),
    where('nameLower', '<', key + ''),
    firestoreLimit(limit),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getActiveCommunities(): Promise<(MunicipalityData & { id: string })[]> {
  const q = query(
    municipalitiesCollection(getDb()),
    where('communityActive', '==', true),
    orderBy('name', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createMunicipality(input: MunicipalityDataInput): Promise<string> {
  const newRef = doc(municipalitiesCollection(getDb()));
  const now = new Date();
  const data: MunicipalityData = {
    name: input.name,
    nameLower: municipalitySearchKey(input.name),
    province: input.province,
    comunidadAutonoma: input.comunidadAutonoma,
    codigoINE: input.codigoINE,
    coordinates: input.coordinates ?? null,
    createdAt: now,
    escudoUrl: input.escudoUrl ?? null,
    escudoThumbUrl: input.escudoThumbUrl ?? null,
    community: null,
    communityActive: false,
  };
  await setDoc(newRef, data);
  return newRef.id;
}

export async function updateMunicipality(
  id: string,
  data: Partial<Pick<MunicipalityData, 'name' | 'province' | 'comunidadAutonoma' | 'codigoINE' | 'coordinates'>>,
): Promise<void> {
  // updateDoc bypasses the converter; use untyped doc + UpdateData<DocumentData>
  // so partial payloads (no required fields, plain values) typecheck.
  const updates: UpdateData<DocumentData> = { ...data };
  await updateDoc(doc(getDb(), 'municipalities', id), updates);
}

export async function deleteMunicipality(id: string): Promise<void> {
  await deleteDoc(municipalityDoc(getDb(), id));
}

// ── Community lifecycle ──────────────────────────────────────────────────

/**
 * Activate a community on a municipality. Atomically:
 *  - sets `community` and `communityActive: true` on the municipality doc
 *  - if `coordinates` provided, updates the municipality's coordinates
 *  - creates a /members/{adminUserId} doc with role=admin
 *
 * The municipality update is batch.update (bypasses the converter, so we can
 * embed serverTimestamp() inside the nested community object). The member
 * doc write is batch.set on a converter-typed ref, so it uses plain Date.
 */
export async function activateCommunity(
  municipalityId: string,
  input: ActivateCommunityInput,
): Promise<void> {
  const munRef = doc(getDb(), 'municipalities', municipalityId);
  const memberRef = municipalityMemberDoc(getDb(), municipalityId, input.adminUserId);

  const community = {
    description: input.description,
    coverImages: input.coverImages ?? [],
    adminUserId: input.adminUserId,
    profileForm: null,
    activatedAt: serverTimestamp(),
  };

  const batch = writeBatch(getDb());
  const munUpdate: UpdateData<DocumentData> = {
    community,
    communityActive: true,
  };
  if (input.coordinates !== undefined) {
    munUpdate['coordinates'] = input.coordinates;
  }
  batch.update(munRef, munUpdate);
  batch.set(memberRef, {
    userId: input.adminUserId,
    role: 'admin',
    joinedAt: new Date(),
    profileAnswers: {},
    profileCompletedAt: null,
    trustedNewsAuthor: false,
  });
  await batch.commit();
}

export async function updateCommunity(
  municipalityId: string,
  data: Partial<Pick<VillageCommunity, 'description' | 'coverImages' | 'adminUserId'>>,
): Promise<void> {
  const updates: UpdateData<DocumentData> = {};
  if (data.description !== undefined) updates['community.description'] = data.description;
  if (data.coverImages !== undefined) updates['community.coverImages'] = data.coverImages;
  if (data.adminUserId !== undefined) updates['community.adminUserId'] = data.adminUserId;
  await updateDoc(doc(getDb(), 'municipalities', municipalityId), updates);
}

export async function deactivateCommunity(municipalityId: string): Promise<void> {
  await updateDoc(doc(getDb(), 'municipalities', municipalityId), {
    community: null,
    communityActive: false,
  });
}

// ── Barrios ──────────────────────────────────────────────────────────────

export async function getBarrios(municipalityId: string): Promise<(BarrioData & { id: string })[]> {
  const q = query(municipalityBarriosCollection(getDb(), municipalityId), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createBarrio(municipalityId: string, input: BarrioDataInput): Promise<string> {
  const newRef = doc(municipalityBarriosCollection(getDb(), municipalityId));
  const data: BarrioData = {
    name: input.name,
    municipalityId,
    createdAt: new Date(),
  };
  await setDoc(newRef, data);
  return newRef.id;
}

export async function updateBarrio(
  municipalityId: string,
  barrioId: string,
  data: Partial<Omit<BarrioData, 'createdAt'>>,
): Promise<void> {
  const updates: UpdateData<DocumentData> = { ...data };
  await updateDoc(doc(getDb(), 'municipalities', municipalityId, 'barrios', barrioId), updates);
}

export async function deleteBarrio(municipalityId: string, barrioId: string): Promise<void> {
  await deleteDoc(municipalityBarrioDoc(getDb(), municipalityId, barrioId));
}

// ── Cemeteries ───────────────────────────────────────────────────────────

export async function getCemeteries(municipalityId: string): Promise<(CemeteryData & { id: string })[]> {
  const q = query(municipalityCemeteriesCollection(getDb(), municipalityId), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createCemetery(municipalityId: string, input: CemeteryDataInput): Promise<string> {
  const newRef = doc(municipalityCemeteriesCollection(getDb(), municipalityId));
  const data: CemeteryData = {
    name: input.name,
    description: input.description ?? null,
    municipalityId,
    createdAt: new Date(),
  };
  await setDoc(newRef, data);
  return newRef.id;
}

export async function updateCemetery(
  municipalityId: string,
  cemeteryId: string,
  data: Partial<Omit<CemeteryData, 'createdAt'>>,
): Promise<void> {
  const updates: UpdateData<DocumentData> = { ...data };
  await updateDoc(doc(getDb(), 'municipalities', municipalityId, 'cemeteries', cemeteryId), updates);
}

export async function deleteCemetery(municipalityId: string, cemeteryId: string): Promise<void> {
  await deleteDoc(municipalityCemeteryDoc(getDb(), municipalityId, cemeteryId));
}

// keep export so other code can call setDoc directly for seed-style work
export { setDoc };
