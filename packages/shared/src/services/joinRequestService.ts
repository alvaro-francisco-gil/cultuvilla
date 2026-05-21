import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  collectionGroup,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDb, getFirebaseFunctions } from '../firebase';
import type {
  JoinRequestData,
  JoinRequestStatus,
} from '../models/municipality/JoinRequestDataModel';

function reqsCol(municipalityId: string) {
  return collection(getDb(), 'municipalities', municipalityId, 'joinRequests');
}

function mapDoc(id: string, data: Record<string, unknown>): JoinRequestData & { id: string } {
  return {
    id,
    userId: data['userId'] as string,
    requestedAt: (data['requestedAt'] as Timestamp).toDate(),
    status: data['status'] as JoinRequestStatus,
    message: (data['message'] as string) ?? null,
    reviewedAt: data['reviewedAt'] ? (data['reviewedAt'] as Timestamp).toDate() : null,
    reviewedBy: (data['reviewedBy'] as string) ?? null,
  };
}

export async function getJoinRequest(
  municipalityId: string,
  userId: string,
): Promise<(JoinRequestData & { id: string }) | null> {
  const snap = await getDoc(doc(reqsCol(municipalityId), userId));
  if (!snap.exists()) return null;
  return mapDoc(snap.id, snap.data());
}

export async function getJoinRequestsForVillage(
  municipalityId: string,
  status?: JoinRequestStatus,
): Promise<(JoinRequestData & { id: string })[]> {
  const base = reqsCol(municipalityId);
  const q = status
    ? query(base, where('status', '==', status), orderBy('requestedAt', 'asc'))
    : query(base, orderBy('requestedAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDoc(d.id, d.data()));
}

export async function getMyJoinRequests(
  userId: string,
): Promise<(JoinRequestData & { id: string; municipalityId: string })[]> {
  const q = query(
    collectionGroup(getDb(), 'joinRequests'),
    where('userId', '==', userId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const municipalityId = d.ref.parent.parent!.id;
    return { ...mapDoc(d.id, d.data()), municipalityId };
  });
}

interface RequestJoinPayload {
  municipalityId: string;
  message?: string | null;
}

export async function requestJoinVillage(payload: RequestJoinPayload): Promise<void> {
  const fn = httpsCallable<RequestJoinPayload, { ok: true }>(
    getFirebaseFunctions(),
    'requestJoinVillage',
  );
  await fn(payload);
}

interface RespondPayload {
  municipalityId: string;
  userId: string;
  decision: 'approved' | 'rejected';
}

export async function respondToJoinRequest(payload: RespondPayload): Promise<void> {
  const fn = httpsCallable<RespondPayload, { ok: true }>(
    getFirebaseFunctions(),
    'respondToJoinRequest',
  );
  await fn(payload);
}
