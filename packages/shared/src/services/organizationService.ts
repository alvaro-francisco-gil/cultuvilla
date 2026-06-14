// packages/shared/src/services/organizationService.ts
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
  serverTimestamp,
  type UpdateData,
  type DocumentData,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import {
  organizationsCollection,
  organizationDoc,
} from '../firebase/refs/client';
import type {
  OrganizationData,
  OrganizationDataInput,
  OrganizationStatus,
} from '../models/organization/OrganizationDataModel';

export async function getOrganization(orgId: string): Promise<(OrganizationData & { id: string }) | null> {
  const snap = await getDoc(organizationDoc(getDb(), orgId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getOrganizationsByMunicipality(
  municipalityId: string,
  status?: OrganizationStatus,
): Promise<(OrganizationData & { id: string })[]> {
  const ref = organizationsCollection(getDb());
  const q = status
    ? query(
        ref,
        where('municipalityId', '==', municipalityId),
        where('status', '==', status),
        orderBy('name', 'asc'),
      )
    : query(
        ref,
        where('municipalityId', '==', municipalityId),
        orderBy('name', 'asc'),
      );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function requestOrganization(input: OrganizationDataInput): Promise<string> {
  const newRef = doc(organizationsCollection(getDb()));
  const data: OrganizationData = {
    name: input.name,
    description: input.description ?? null,
    imageURL: input.imageURL ?? null,
    type: input.type,
    status: 'pending',
    municipalityId: input.municipalityId,
    requestedBy: input.requestedBy,
    approvedBy: null,
    createdAt: input.createdAt ?? new Date(),
    decidedAt: null,
  };
  await setDoc(newRef, data);
  return newRef.id;
}

export async function approveOrganization(orgId: string, approvedBy: string): Promise<void> {
  // updateDoc bypasses the converter, so serverTimestamp() is fine here.
  await updateDoc(doc(getDb(), 'organizations', orgId), {
    status: 'approved',
    approvedBy,
    decidedAt: serverTimestamp(),
  });
}

export async function rejectOrganization(orgId: string): Promise<void> {
  await updateDoc(doc(getDb(), 'organizations', orgId), {
    status: 'rejected',
    approvedBy: null,
    decidedAt: serverTimestamp(),
  });
}

export async function updateOrganization(
  orgId: string,
  data: Partial<Omit<OrganizationData, 'createdAt' | 'requestedBy' | 'municipalityId'>>,
): Promise<void> {
  const updates: UpdateData<DocumentData> = { ...data };
  await updateDoc(doc(getDb(), 'organizations', orgId), updates);
}

export async function deleteOrganization(orgId: string): Promise<void> {
  await deleteDoc(organizationDoc(getDb(), orgId));
}
