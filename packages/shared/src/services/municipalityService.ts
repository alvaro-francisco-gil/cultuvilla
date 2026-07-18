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
  startAfter,
  limit as firestoreLimit,
  type UpdateData,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDb, getFirebaseFunctions } from '../firebase';
import {
  municipalitiesCollection,
  municipalityDoc,
  municipalityBarriosCollection,
  municipalityBarrioDoc,
  municipalityPlacesCollection,
  municipalityPlaceDoc,
} from '../firebase/refs/client';
import type {
  MunicipalityData,
  MunicipalityDataInput,
  VillageCommunity,
  BarrioData,
  BarrioDataInput,
  PlaceData,
  PlaceDataInput,
  PlaceKind,
} from '../models/municipality';
import {
  municipalitySearchKey,
  buildMunicipalityData,
  buildBarrioData,
  buildPlaceData,
} from '../models/municipality/MunicipalityDataModel';

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

export interface MunicipalitiesPage {
  items: (MunicipalityData & { id: string })[];
  nextCursor: QueryDocumentSnapshot | null;
}

/**
 * One cursor-paginated page of municipalities ordered by `nameLower`.
 *
 * - `search` (optional) applies the same accent-stripped prefix match as
 *   `searchMunicipalities` so the active-group filter and the full-list search
 *   agree.
 * - `cursor` is the opaque `nextCursor` from the previous page (omit/`null`
 *   for the first page). Pages with `startAfter`.
 * - `nextCursor` is the last snapshot of a full page, or `null` once fewer than
 *   `limit` rows come back (list exhausted).
 */
export async function listMunicipalitiesPage(opts: {
  search?: string;
  cursor?: QueryDocumentSnapshot | null;
  limit?: number;
}): Promise<MunicipalitiesPage> {
  const pageSize = opts.limit ?? 20;
  const key = municipalitySearchKey((opts.search ?? '').trim());
  const constraints: QueryConstraint[] = [orderBy('nameLower', 'asc')];
  if (key.length > 0) {
    constraints.push(where('nameLower', '>=', key));
    constraints.push(where('nameLower', '<', key + ''));
  }
  if (opts.cursor) constraints.push(startAfter(opts.cursor));
  constraints.push(firestoreLimit(pageSize));

  const snap = await getDocs(query(municipalitiesCollection(getDb()), ...constraints));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // The cursor is opaque to callers (handed straight back to startAfter), so we
  // erase the converter's model generic to the public QueryDocumentSnapshot.
  const nextCursor =
    snap.docs.length === pageSize
      ? (snap.docs[snap.docs.length - 1] as QueryDocumentSnapshot)
      : null;
  return { items, nextCursor };
}

export async function createMunicipality(input: MunicipalityDataInput): Promise<string> {
  const newRef = doc(municipalitiesCollection(getDb()));
  await setDoc(newRef, buildMunicipalityData(input));
  return newRef.id;
}

export async function updateMunicipality(
  id: string,
  data: Partial<
    Pick<
      MunicipalityData,
      | 'name'
      | 'province'
      | 'comunidadAutonoma'
      | 'codigoINE'
      | 'coordinates'
      | 'mapZoom'
      | 'escudoManualUrl'
    >
  >,
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
//
// A dormant municipality's community is *activated* by the `startVillage`
// callable (any villager — organizerId starts null). Basic info is edited via
// the `updateVillageInfo` callable, which enforces the wiki-phase rule
// server-side. The organizer role is granted separately by
// respondToOrganizerRequest. The direct-write helpers below only apply once the
// caller is a village admin (the admin community-edit screen).

interface StartVillagePayload {
  municipalityId: string;
  description?: string;
  /** URL of an escudo uploaded during activation; set server-side only when
   *  the village has no escudo yet (admin-only field on the client). */
  escudoManualUrl?: string;
}

/** Activate a dormant municipality's community and join it as the first member. */
export async function startVillage(payload: StartVillagePayload): Promise<void> {
  const fn = httpsCallable<StartVillagePayload, { ok: true }>(
    getFirebaseFunctions(),
    'startVillage',
  );
  await fn(payload);
}

interface UpdateVillageInfoPayload {
  municipalityId: string;
  description?: string;
}

/** Edit a village's basic info. Allowed for any member during the wiki phase
 *  (no organizer yet), and for admins afterwards — enforced server-side. */
export async function updateVillageInfo(payload: UpdateVillageInfoPayload): Promise<void> {
  const fn = httpsCallable<UpdateVillageInfoPayload, { ok: true }>(
    getFirebaseFunctions(),
    'updateVillageInfo',
  );
  await fn(payload);
}

export async function updateCommunity(
  municipalityId: string,
  data: Partial<Pick<VillageCommunity, 'description' | 'organizerId'>>,
): Promise<void> {
  const updates: UpdateData<DocumentData> = {};
  if (data.description !== undefined) updates['community.description'] = data.description;
  if (data.organizerId !== undefined) updates['community.organizerId'] = data.organizerId;
  await updateDoc(doc(getDb(), 'municipalities', municipalityId), updates);
}

export async function deactivateCommunity(municipalityId: string): Promise<void> {
  await updateDoc(doc(getDb(), 'municipalities', municipalityId), {
    community: null,
    communityActive: false,
  });
}

// ── Barrios ──────────────────────────────────────────────────────────────
//
// Any village member may create a barrio; it lands `active` and is visible to
// everyone immediately. Village/app admins can hide it afterward via
// `moderationService`. Enforcement lives in firestore.rules.

export async function getBarrios(municipalityId: string): Promise<(BarrioData & { id: string })[]> {
  const q = query(
    municipalityBarriosCollection(getDb(), municipalityId),
    where('status', '==', 'active'),
    orderBy('name', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Mint a barrio doc id up front, so images can be uploaded to its storage
 * path before `createBarrio` writes the doc (with images). */
export function newBarrioId(municipalityId: string): string {
  return doc(municipalityBarriosCollection(getDb(), municipalityId)).id;
}

export async function createBarrio(
  municipalityId: string,
  input: BarrioDataInput,
  id: string = newBarrioId(municipalityId),
): Promise<string> {
  const newRef = municipalityBarrioDoc(getDb(), municipalityId, id);
  await setDoc(newRef, buildBarrioData({ ...input, municipalityId }));
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

/** Fetch a single barrio document, or `null` if it does not exist. */
export async function getBarrio(
  municipalityId: string,
  barrioId: string,
): Promise<(BarrioData & { id: string }) | null> {
  const snap = await getDoc(municipalityBarrioDoc(getDb(), municipalityId, barrioId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Places (cemeteries, churches, …) ───────────────────────────────────────
//
// Any village member may create a place; it lands `active` and is visible to
// everyone immediately. Village/app admins can hide it afterward via
// `moderationService`. Enforcement lives in firestore.rules.

// Returns all active places for a municipality ordered by name. Pass `kind` to
// filter in memory — a village has few places, so we avoid a composite index.
export async function getPlaces(
  municipalityId: string,
  kind?: PlaceKind,
): Promise<(PlaceData & { id: string })[]> {
  const q = query(
    municipalityPlacesCollection(getDb(), municipalityId),
    where('status', '==', 'active'),
    orderBy('name', 'asc'),
  );
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return kind ? rows.filter((r) => r.kind === kind) : rows;
}

/** Mint a place doc id up front, so images can be uploaded to its storage
 * path before `createPlace` writes the doc (with images). */
export function newPlaceId(municipalityId: string): string {
  return doc(municipalityPlacesCollection(getDb(), municipalityId)).id;
}

export async function createPlace(
  municipalityId: string,
  input: PlaceDataInput,
  id: string = newPlaceId(municipalityId),
): Promise<string> {
  const newRef = municipalityPlaceDoc(getDb(), municipalityId, id);
  await setDoc(newRef, buildPlaceData({ ...input, municipalityId }));
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

/** Fetch a single place document, or `null` if it does not exist. */
export async function getPlace(
  municipalityId: string,
  placeId: string,
): Promise<(PlaceData & { id: string }) | null> {
  const snap = await getDoc(municipalityPlaceDoc(getDb(), municipalityId, placeId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// keep export so other code can call setDoc directly for seed-style work
export { setDoc };
