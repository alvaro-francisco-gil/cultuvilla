import { getDocs, query, where, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDb, getFirebaseFunctions } from '../firebase';
import { organizationJoinRequestsCollection } from '../firebase/refs/client';
import type { OrganizationJoinRequestData } from '../models/organizationJoinRequest/OrganizationJoinRequestDataModel';

type WithId = OrganizationJoinRequestData & { id: string };

export async function requestJoinOrganization(orgId: string): Promise<{ requestId: string }> {
  const fn = httpsCallable<{ orgId: string }, { ok: true; requestId: string }>(
    getFirebaseFunctions(), 'requestJoinOrganization',
  );
  const res = await fn({ orgId });
  return { requestId: res.data.requestId };
}

export async function respondToJoinRequest(
  requestId: string, decision: 'approved' | 'rejected',
): Promise<void> {
  const fn = httpsCallable<{ requestId: string; decision: 'approved' | 'rejected' }, { ok: true }>(
    getFirebaseFunctions(), 'respondToJoinRequest',
  );
  await fn({ requestId, decision });
}

export async function getAllPendingJoinRequests(): Promise<WithId[]> {
  const q = query(organizationJoinRequestsCollection(getDb()),
    where('status', '==', 'pending'), orderBy('requestedAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getPendingJoinRequestsForOrgs(orgIds: string[]): Promise<WithId[]> {
  const out: WithId[] = [];
  for (let i = 0; i < orgIds.length; i += 30) {
    const chunk = orgIds.slice(i, i + 30);
    if (chunk.length === 0) continue;
    const q = query(organizationJoinRequestsCollection(getDb()),
      where('orgId', 'in', chunk), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    out.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  return out;
}

export async function getMyJoinRequests(userId: string): Promise<WithId[]> {
  const q = query(organizationJoinRequestsCollection(getDb()),
    where('userId', '==', userId), orderBy('requestedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
