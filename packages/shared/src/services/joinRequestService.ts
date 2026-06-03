// packages/shared/src/services/joinRequestService.ts
import {
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  collectionGroup,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDb, getFirebaseFunctions } from '../firebase';
import {
  municipalityJoinRequestsCollection,
  municipalityJoinRequestDoc,
} from '../firebase/refs/client';
import { joinRequestConverterClient } from '../firebase/converters/joinRequestConverter.client';
import type {
  JoinRequestData,
  JoinRequestStatus,
} from '../models/municipality/JoinRequestDataModel';

export async function getJoinRequest(
  municipalityId: string,
  userId: string,
): Promise<(JoinRequestData & { id: string }) | null> {
  const snap = await getDoc(municipalityJoinRequestDoc(getDb(), municipalityId, userId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getJoinRequestsForVillage(
  municipalityId: string,
  status?: JoinRequestStatus,
): Promise<(JoinRequestData & { id: string })[]> {
  const base = municipalityJoinRequestsCollection(getDb(), municipalityId);
  const q = status
    ? query(base, where('status', '==', status), orderBy('requestedAt', 'asc'))
    : query(base, orderBy('requestedAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getMyJoinRequests(
  userId: string,
): Promise<(JoinRequestData & { id: string; municipalityId: string })[]> {
  // collectionGroup queries can't take a single typed ref; attach the
  // converter to the group ref so reads come back validated.
  const q = query(
    collectionGroup(getDb(), 'joinRequests').withConverter(joinRequestConverterClient),
    where('userId', '==', userId),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const municipalityId = d.ref.parent.parent?.id;
      if (!municipalityId) return null;
      return { id: d.id, ...d.data(), municipalityId };
    })
    .filter((r): r is JoinRequestData & { id: string; municipalityId: string } => r !== null);
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
