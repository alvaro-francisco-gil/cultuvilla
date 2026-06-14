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
  municipalityPlacesCollection,
  municipalityPlaceDoc,
  municipalityMemberDoc,
} from '../firebase/refs/client';
import type {
  MunicipalityData,
  MunicipalityDataInput,
  VillageCommunity,
  ActivateCommunityInput,
  BarrioData,
  BarrioDataInput,
  PlaceData,
  PlaceDataInput,
  PlaceKind,
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
  // batch.update bypasses the converter; pass an untyped ref so the partial +
  // FieldValue payload typechecks.
  batch.update(doc(getDb(), 'municipalities', municipalityId), munUpdate);
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
    imageURL: input.imageURL ?? null,
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

// ── Places (cemeteries, churches, …) ───────────────────────────────────────

// Returns all places for a municipality ordered by name. Pass `kind` to filter
// in memory — a village has few places, so we avoid a composite index.
export async function getPlaces(
  municipalityId: string,
  kind?: PlaceKind,
): Promise<(PlaceData & { id: string })[]> {
  const q = query(municipalityPlacesCollection(getDb(), municipalityId), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return kind ? rows.filter((r) => r.kind === kind) : rows;
}

export async function createPlace(municipalityId: string, input: PlaceDataInput): Promise<string> {
  const newRef = doc(municipalityPlacesCollection(getDb(), municipalityId));
  const data: PlaceData = {
    name: input.name,
    kind: input.kind,
    description: input.description ?? null,
    municipalityId,
    imageURL: input.imageURL ?? null,
    createdAt: new Date(),
  };
  await setDoc(newRef, data);
  return newRef.id;
}

export async function updatePlace(
  municipalityId: string,
  placeId: string,
  data: Partial<Omit<PlaceData, 'createdAt'>>,
): Promise<void> {
  const updates: UpdateData<DocumentData> = { ...data };
  await updateDoc(doc(getDb(), 'municipalities', municipalityId, 'places', placeId), updates);
}

export async function deletePlace(municipalityId: string, placeId: string): Promise<void> {
  await deleteDoc(municipalityPlaceDoc(getDb(), municipalityId, placeId));
}

// keep export so other code can call setDoc directly for seed-style work
export { setDoc };
