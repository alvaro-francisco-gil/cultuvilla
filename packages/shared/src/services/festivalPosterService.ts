import {
  doc,
  deleteDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import { festivalPostersCollection, festivalPosterDoc } from '../firebase/refs/client';
import {
  buildFestivalPosterData,
  type FestivalPosterData,
  type FestivalPosterDataInput,
} from '../models/festivalPoster/FestivalPosterDataModel';
import type { ReviewStatus } from '../models/core/ReviewableDataModel';

export type FestivalPosterWithId = FestivalPosterData & { id: string };

/** Mint an id up front so the poster image can be uploaded before the doc write. */
export function newFestivalPosterId(): string {
  return doc(festivalPostersCollection(getDb())).id;
}

async function writePoster(id: string, input: FestivalPosterDataInput): Promise<string> {
  await setDoc(festivalPosterDoc(getDb(), id), buildFestivalPosterData(input));
  return id;
}

/** Villager proposal → status 'pending'. */
export function proposeFestivalPoster(
  input: Omit<FestivalPosterDataInput, 'status'> & { proposedBy: string },
  id: string = newFestivalPosterId(),
): Promise<string> {
  return writePoster(id, { ...input, status: 'pending' });
}

/** Admin direct add → status 'approved'. */
export function createFestivalPoster(
  input: Omit<FestivalPosterDataInput, 'status'>,
  id: string = newFestivalPosterId(),
): Promise<string> {
  return writePoster(id, { ...input, status: 'approved' });
}

export async function getFestivalPosters(
  municipalityId: string,
  status?: ReviewStatus,
): Promise<FestivalPosterWithId[]> {
  const constraints: QueryConstraint[] = [where('municipalityId', '==', municipalityId)];
  if (status) constraints.push(where('status', '==', status));
  constraints.push(orderBy('year', 'desc'));
  const snap = await getDocs(query(festivalPostersCollection(getDb()), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Partial writes use a raw (converter-less) ref: the SDK auto-converts Date → Timestamp,
// and updateDoc must not run the strict full-object converter. Approval is authorised
// entirely by firestore.rules (admin's allow-update is unconstrained on status).
export function approveFestivalPoster(posterId: string, reviewedBy: string): Promise<void> {
  return updateDoc(doc(getDb(), 'festivalPosters', posterId), {
    status: 'approved',
    reviewedBy,
    reviewedAt: serverTimestamp(),
  });
}

export function rejectFestivalPoster(posterId: string, reviewedBy: string): Promise<void> {
  return updateDoc(doc(getDb(), 'festivalPosters', posterId), {
    status: 'rejected',
    reviewedBy,
    reviewedAt: serverTimestamp(),
  });
}

export function updateFestivalPoster(
  posterId: string,
  patch: Partial<
    Pick<FestivalPosterData, 'year' | 'title' | 'imageURL' | 'datePrecision' | 'startsAt' | 'endsAt'>
  >,
): Promise<void> {
  return updateDoc(doc(getDb(), 'festivalPosters', posterId), patch);
}

export function deleteFestivalPoster(posterId: string): Promise<void> {
  return deleteDoc(doc(getDb(), 'festivalPosters', posterId));
}
