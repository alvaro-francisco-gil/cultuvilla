// packages/shared/src/services/orgMemberService.ts
import { getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDb, getFirebaseFunctions } from '../firebase';
import {
  organizationMembersCollection,
  organizationMemberDoc,
} from '../firebase/refs/client';
import type { OrgMemberData } from '../models/organization/OrgMemberDataModel';
import { buildOrgMemberData, type OrgMemberRole } from '../models/organization/OrgMemberDataModel';

export async function getOrgMembers(orgId: string): Promise<(OrgMemberData & { id: string })[]> {
  const snap = await getDocs(organizationMembersCollection(getDb(), orgId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addOrgMember(
  orgId: string,
  userId: string,
  role: OrgMemberRole = 'member',
): Promise<void> {
  await setDoc(organizationMemberDoc(getDb(), orgId, userId), buildOrgMemberData({ userId, role }));
}

/**
 * Promote/demote an org member — the only way to make (or unmake) an org admin.
 * Thin wrapper over the `changeOrgMemberRole` callable, which checks authority,
 * updates the role, and writes a `membershipEvents` audit record in one
 * transaction. Clients can no longer write `role` directly (function-owned).
 */
export async function setOrgMemberRole(
  orgId: string,
  userId: string,
  role: OrgMemberRole,
): Promise<void> {
  const fn = httpsCallable<{ orgId: string; targetUserId: string; role: OrgMemberRole }, { ok: true }>(
    getFirebaseFunctions(),
    'changeOrgMemberRole',
  );
  await fn({ orgId, targetUserId: userId, role });
}

export async function getOrgAdminIds(orgId: string): Promise<string[]> {
  const members = await getOrgMembers(orgId);
  return members.filter((m) => m.role === 'admin').map((m) => m.id);
}

export async function removeOrgMember(orgId: string, userId: string): Promise<void> {
  await deleteDoc(organizationMemberDoc(getDb(), orgId, userId));
}

export async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
  const snap = await getDoc(organizationMemberDoc(getDb(), orgId, userId));
  return snap.exists();
}

/**
 * True iff `userId` is an admin of the org. Authority is the role flag, never
 * the founder pointer (AGENTS.md §Membership roles) — the founder is seeded as
 * admin on approval, so this covers "a group I created" without special-casing.
 */
export async function isOrgAdmin(orgId: string, userId: string): Promise<boolean> {
  const snap = await getDoc(organizationMemberDoc(getDb(), orgId, userId));
  return snap.exists() && snap.data().role === 'admin';
}

export interface UserOrgMembership {
  orgId: string;
  role: OrgMemberRole;
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
      if (!snap.exists()) return null;
      const data = snap.data();
      return { orgId, role: data.role };
    }),
  );
  // The municipality argument is currently passed through for symmetry with
  // future server-side filtering; not used in the body yet.
  void municipalityId;
  return checks.filter((m): m is UserOrgMembership => m !== null);
}
