// packages/shared/src/services/orgMemberService.ts
import { getCountFromServer, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { getDb } from '../firebase';
import {
  organizationMembersCollection,
  organizationMemberDoc,
} from '../firebase/refs/client';
import type { OrgMemberData } from '../models/organization/OrgMemberDataModel';

export async function getOrgMembers(orgId: string): Promise<(OrgMemberData & { id: string })[]> {
  const snap = await getDocs(organizationMembersCollection(getDb(), orgId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Server-side aggregate; avoids pulling every member doc just to size the scroll card.
export async function getOrgMemberCount(orgId: string): Promise<number> {
  const snap = await getCountFromServer(organizationMembersCollection(getDb(), orgId));
  return snap.data().count;
}

export async function addOrgMember(orgId: string, userId: string): Promise<void> {
  await setDoc(organizationMemberDoc(getDb(), orgId, userId), {
    joinedAt: new Date(),
  });
}

export async function removeOrgMember(orgId: string, userId: string): Promise<void> {
  await deleteDoc(organizationMemberDoc(getDb(), orgId, userId));
}

export async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
  const snap = await getDoc(organizationMemberDoc(getDb(), orgId, userId));
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
  orgIdsCandidate: string[],
): Promise<UserOrgMembership[]> {
  const checks = await Promise.all(
    orgIdsCandidate.map(async (orgId) => {
      const snap = await getDoc(organizationMemberDoc(getDb(), orgId, userId));
      return snap.exists() ? { orgId } : null;
    }),
  );
  // The municipality argument is currently passed through for symmetry with
  // future server-side filtering; not used in the body yet.
  void municipalityId;
  return checks.filter((m): m is UserOrgMembership => m !== null);
}
