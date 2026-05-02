import {
  collection,
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
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  OrganizationData,
  OrganizationDataInput,
  OrganizationStatus,
} from '../models/organization/OrganizationDataModel';

function orgsCol() {
  return collection(db, 'organizations');
}

function mapOrgDoc(d: { id: string; data: () => Record<string, unknown> }): OrganizationData & { id: string } {
  const data = d.data();
  const decidedAtRaw = data['decidedAt'];
  return {
    id: d.id,
    name: data['name'] as string,
    description: (data['description'] as string | null) ?? null,
    type: data['type'] as OrganizationData['type'],
    status: data['status'] as OrganizationStatus,
    villageId: data['villageId'] as string,
    requestedBy: data['requestedBy'] as string,
    approvedBy: (data['approvedBy'] as string | null) ?? null,
    createdAt: (data['createdAt'] as Timestamp).toDate(),
    decidedAt: decidedAtRaw ? (decidedAtRaw as Timestamp).toDate() : null,
  };
}

export async function getOrganization(orgId: string): Promise<(OrganizationData & { id: string }) | null> {
  const snap = await getDoc(doc(orgsCol(), orgId));
  if (!snap.exists()) return null;
  return mapOrgDoc(snap as Parameters<typeof mapOrgDoc>[0]);
}

export async function getOrganizationsByVillage(
  villageId: string,
  status?: OrganizationStatus
): Promise<(OrganizationData & { id: string })[]> {
  const constraints = status
    ? [where('villageId', '==', villageId), where('status', '==', status), orderBy('name', 'asc')]
    : [where('villageId', '==', villageId), orderBy('name', 'asc')];
  const q = query(orgsCol(), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapOrgDoc(d as Parameters<typeof mapOrgDoc>[0]));
}

export async function requestOrganization(input: OrganizationDataInput): Promise<string> {
  const newRef = doc(orgsCol());
  await setDoc(newRef, {
    name: input.name,
    description: input.description ?? null,
    type: input.type,
    status: 'pending',
    villageId: input.villageId,
    requestedBy: input.requestedBy,
    approvedBy: null,
    createdAt: serverTimestamp(),
    decidedAt: null,
  });
  return newRef.id;
}

export async function approveOrganization(orgId: string, approvedBy: string): Promise<void> {
  await updateDoc(doc(orgsCol(), orgId), {
    status: 'approved',
    approvedBy,
    decidedAt: serverTimestamp(),
  });
}

export async function rejectOrganization(orgId: string, decidedBy: string): Promise<void> {
  await updateDoc(doc(orgsCol(), orgId), {
    status: 'rejected',
    approvedBy: decidedBy,
    decidedAt: serverTimestamp(),
  });
}

export async function updateOrganization(
  orgId: string,
  data: Partial<Omit<OrganizationData, 'createdAt' | 'requestedBy' | 'villageId'>>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(orgsCol(), orgId), data as any);
}

export async function deleteOrganization(orgId: string): Promise<void> {
  await deleteDoc(doc(orgsCol(), orgId));
}
