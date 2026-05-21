import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDb, getFirebaseFunctions } from '../firebase';
import type {
  OrganizerRequestData,
  OrganizerRequestStatus,
} from '../models/municipality/OrganizerRequestDataModel';

function reqsCol() {
  return collection(getDb(), 'organizerRequests');
}

function mapDoc(id: string, data: Record<string, unknown>): OrganizerRequestData & { id: string } {
  return {
    id,
    userId: data['userId'] as string,
    municipalityId: data['municipalityId'] as string,
    requestedAt: (data['requestedAt'] as Timestamp).toDate(),
    status: data['status'] as OrganizerRequestStatus,
    motivation: (data['motivation'] as string) ?? null,
    reviewedAt: data['reviewedAt'] ? (data['reviewedAt'] as Timestamp).toDate() : null,
    reviewedBy: (data['reviewedBy'] as string) ?? null,
  };
}

export async function getOrganizerRequest(
  id: string,
): Promise<(OrganizerRequestData & { id: string }) | null> {
  const snap = await getDoc(doc(reqsCol(), id));
  if (!snap.exists()) return null;
  return mapDoc(snap.id, snap.data());
}

export async function getPendingOrganizerRequests(): Promise<(OrganizerRequestData & { id: string })[]> {
  const q = query(reqsCol(), where('status', '==', 'pending'), orderBy('requestedAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDoc(d.id, d.data()));
}

export async function getMyOrganizerRequests(
  userId: string,
): Promise<(OrganizerRequestData & { id: string })[]> {
  const q = query(reqsCol(), where('userId', '==', userId), orderBy('requestedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDoc(d.id, d.data()));
}

interface RequestOrgPayload {
  municipalityId: string;
  motivation?: string | null;
}

export async function requestOrganizeVillage(payload: RequestOrgPayload): Promise<void> {
  const fn = httpsCallable<RequestOrgPayload, { ok: true; requestId: string }>(
    getFirebaseFunctions(),
    'requestOrganizeVillage',
  );
  await fn(payload);
}

interface RespondOrgPayload {
  requestId: string;
  decision: 'approved' | 'rejected';
}

export async function respondToOrganizerRequest(payload: RespondOrgPayload): Promise<void> {
  const fn = httpsCallable<RespondOrgPayload, { ok: true }>(
    getFirebaseFunctions(),
    'respondToOrganizerRequest',
  );
  await fn(payload);
}
