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
