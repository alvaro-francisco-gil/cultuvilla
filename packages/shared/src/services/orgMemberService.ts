import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import type { OrgMemberData } from '../models/organization/OrgMemberDataModel';

function orgMembersCol(orgId: string) {
  return collection(getDb(), 'organizations', orgId, 'members');
}

export async function getOrgMembers(orgId: string): Promise<(OrgMemberData & { id: string })[]> {
  const snap = await getDocs(orgMembersCol(orgId));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      joinedAt: (data['joinedAt'] as Timestamp).toDate(),
    };
  });
}

export async function addOrgMember(orgId: string, userId: string): Promise<void> {
  await setDoc(doc(orgMembersCol(orgId), userId), {
    joinedAt: serverTimestamp(),
  });
}

export async function removeOrgMember(orgId: string, userId: string): Promise<void> {
  await deleteDoc(doc(orgMembersCol(orgId), userId));
}

export async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
  const snap = await getDoc(doc(orgMembersCol(orgId), userId));
  return snap.exists();
}

export interface UserOrgMembership {
  orgId: string;
}

/**
 * Reverse lookup: which organizations does `userId` belong to within a given
 * municipality. Fetches all orgs in the municipality and checks membership in
 * parallel — fine for the dev/early-stage scale; revisit when org counts grow.
 */
export async function getOrgMembershipsByUserInMunicipality(
  userId: string,
  municipalityId: string,
  orgIdsCandidate: string[]
): Promise<UserOrgMembership[]> {
  const checks = await Promise.all(
    orgIdsCandidate.map(async (orgId) => {
      const snap = await getDoc(doc(orgMembersCol(orgId), userId));
      return snap.exists() ? { orgId } : null;
    })
  );
  // The municipality argument is currently passed through for symmetry with
  // future server-side filtering; not used in the body yet.
  void municipalityId;
  return checks.filter((m): m is UserOrgMembership => m !== null);
}
