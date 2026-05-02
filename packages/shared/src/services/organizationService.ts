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

function orgsCol(villageId: string) {
  return collection(db, 'villages', villageId, 'organizations');
}

function mapOrgDoc(d: { id: string; data: () => Record<string, unknown> }): OrganizationData & { id: string } {
  const data = d.data();
  return {
    id: d.id,
    name: data['name'] as string,
    description: (data['description'] as string | null) ?? null,
    type: data['type'] as OrganizationData['type'],
    status: data['status'] as OrganizationStatus,
    villageId: (data['villageId'] as string) ?? '',
    requestedBy: data['requestedBy'] as string,
    approvedBy: (data['approvedBy'] as string | null) ?? null,
    createdAt: (data['createdAt'] as Timestamp).toDate(),
    decidedAt: data['decidedAt'] != null ? (data['decidedAt'] as Timestamp).toDate() : null,
  };
}

export async function getOrganization(
  villageId: string,
  orgId: string
): Promise<(OrganizationData & { id: string }) | null> {
  const snap = await getDoc(doc(orgsCol(villageId), orgId));
  if (!snap.exists()) return null;
  return mapOrgDoc(snap as Parameters<typeof mapOrgDoc>[0]);
}

export async function getOrganizations(
  villageId: string,
  status?: OrganizationStatus
): Promise<(OrganizationData & { id: string })[]> {
  const constraints = status
    ? [where('status', '==', status), orderBy('name', 'asc')]
    : [orderBy('name', 'asc')];
  const q = query(orgsCol(villageId), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapOrgDoc(d as Parameters<typeof mapOrgDoc>[0]));
}

export async function requestOrganization(
  villageId: string,
  input: OrganizationDataInput
): Promise<string> {
  const newRef = doc(orgsCol(villageId));
  await setDoc(newRef, {
    name: input.name,
    description: input.description ?? null,
    type: input.type,
    status: 'pending',
    requestedBy: input.requestedBy,
    createdAt: serverTimestamp(),
  });
  return newRef.id;
}

export async function approveOrganization(
  villageId: string,
  orgId: string
): Promise<void> {
  await updateDoc(doc(orgsCol(villageId), orgId), { status: 'approved' });
}

export async function rejectOrganization(
  villageId: string,
  orgId: string
): Promise<void> {
  await updateDoc(doc(orgsCol(villageId), orgId), { status: 'rejected' });
}

export async function updateOrganization(
  villageId: string,
  orgId: string,
  data: Partial<Omit<OrganizationData, 'createdAt' | 'requestedBy'>>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(orgsCol(villageId), orgId), data as any);
}

export async function deleteOrganization(
  villageId: string,
  orgId: string
): Promise<void> {
  await deleteDoc(doc(orgsCol(villageId), orgId));
}
