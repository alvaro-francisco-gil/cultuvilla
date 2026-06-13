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
import { httpsCallable } from 'firebase/functions';
import { getDb, getFirebaseFunctions } from '../firebase';
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
  // ayuntamiento is a singleton per village; the cap can only be enforced
  // server-side (rules can't query for an existing one), so it goes through the
  // requestAyuntamiento callable. peña / asociación are unlimited, written directly.
  if (input.type === 'ayuntamiento') {
    const fn = httpsCallable<
      { name: string; description: string | null; municipalityId: string },
      { ok: true; orgId: string }
    >(getFirebaseFunctions(), 'requestAyuntamiento');
    const res = await fn({
      name: input.name,
      description: input.description ?? null,
      municipalityId: input.municipalityId,
    });
    return res.data.orgId;
  }

  const newRef = doc(organizationsCollection(getDb()));
  const data: OrganizationData = {
    name: input.name,
    description: input.description ?? null,
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
