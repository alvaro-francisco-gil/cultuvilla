import {
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import {
  occupationsCollection,
  occupationDoc,
  occupationProposalsCollection,
} from '../firebase/refs/client';
import {
  buildOccupationData,
  buildOccupationProposalData,
  type OccupationData,
  type OccupationDataInput,
  type OccupationProposalData,
} from '../models/occupation/OccupationDataModel';

export async function getOccupations(): Promise<(OccupationData & { id: string })[]> {
  const q = query(occupationsCollection(getDb()), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createOccupation(input: OccupationDataInput): Promise<string> {
  // doc() on a typed collection ref yields an auto-id typed doc ref.
  const ref = doc(occupationsCollection(getDb()));
  // setDoc routes through the typed converter — createdAt must be a plain
  // Date (serverTimestamp sentinels are rejected by the schema).
  await setDoc(ref, buildOccupationData(input));
  return ref.id;
}

export async function proposeOccupation(name: string, proposedBy: string): Promise<string> {
  const ref = doc(occupationProposalsCollection(getDb()));
  await setDoc(ref, buildOccupationProposalData({ name, proposedBy }));
  return ref.id;
}

export async function getPendingProposals(): Promise<(OccupationProposalData & { id: string })[]> {
  const q = query(
    occupationProposalsCollection(getDb()),
    where('status', '==', 'pending'),
    orderBy('proposedAt', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function reviewProposal(
  proposalId: string,
  status: 'approved' | 'rejected',
  reviewedBy: string,
  approvedOccupationId?: string | null,
): Promise<void> {
  // updateDoc bypasses the converter, so partial-update payloads (and the
  // serverTimestamp sentinel) go on the raw doc ref rather than the typed one.
  await updateDoc(doc(getDb(), 'occupationProposals', proposalId), {
    status,
    reviewedBy,
    reviewedAt: serverTimestamp(),
    approvedOccupationId: approvedOccupationId ?? null,
  });
}

export async function updateOccupation(
  id: string,
  data: Partial<Omit<OccupationData, 'createdAt'>>,
): Promise<void> {
  // updateDoc bypasses the converter; pass a partial on the raw doc ref.
  await updateDoc(doc(getDb(), 'occupations', id), data);
}

export async function deleteOccupation(id: string): Promise<void> {
  await deleteDoc(occupationDoc(getDb(), id));
}
