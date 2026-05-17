import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { OccupationData, OccupationDataInput, OccupationProposalData, OccupationProposalStatus } from '../models/occupation'

function occupationsCol() {
  return collection(db, 'occupations')
}
function proposalsCol() {
  return collection(db, 'occupationProposals')
}

export async function getOccupations(): Promise<(OccupationData & { id: string })[]> {
  const q = query(occupationsCol(), orderBy('name', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>
    return {
      id: d.id,
      name: data.name as string,
      createdBy: data.createdBy as string,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    }
  })
}

export async function createOccupation(input: OccupationDataInput): Promise<string> {
  const ref = await addDoc(occupationsCol(), { ...input, createdAt: serverTimestamp() })
  return ref.id
}

export async function proposeOccupation(name: string, proposedBy: string): Promise<string> {
  const ref = await addDoc(proposalsCol(), {
    name,
    proposedBy,
    proposedAt: serverTimestamp(),
    status: 'pending' as OccupationProposalStatus,
    reviewedBy: null,
    reviewedAt: null,
  })
  return ref.id
}

export async function getPendingProposals(): Promise<(OccupationProposalData & { id: string })[]> {
  const q = query(proposalsCol(), where('status', '==', 'pending'), orderBy('proposedAt', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>
    return {
      id: d.id,
      name: data.name as string,
      proposedBy: data.proposedBy as string,
      proposedAt: data.proposedAt instanceof Timestamp ? data.proposedAt.toDate() : new Date(),
      status: data.status as OccupationProposalStatus,
      reviewedBy: (data.reviewedBy as string | null) ?? null,
      reviewedAt: data.reviewedAt instanceof Timestamp ? data.reviewedAt.toDate() : null,
      approvedOccupationId: (data.approvedOccupationId as string | null) ?? null,
    }
  })
}

export async function reviewProposal(
  proposalId: string,
  status: 'approved' | 'rejected',
  reviewedBy: string,
  approvedOccupationId?: string | null,
): Promise<void> {
  await updateDoc(doc(proposalsCol(), proposalId), {
    status,
    reviewedBy,
    reviewedAt: serverTimestamp(),
    approvedOccupationId: approvedOccupationId ?? null,
  })
}

export async function updateOccupation(id: string, data: Partial<Omit<OccupationData, 'createdAt'>>): Promise<void> {
  await updateDoc(doc(occupationsCol(), id), data as any)
}

export async function deleteOccupation(id: string): Promise<void> {
  await deleteDoc(doc(occupationsCol(), id))
}
