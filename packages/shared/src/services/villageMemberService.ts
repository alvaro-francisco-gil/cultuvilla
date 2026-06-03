import {
  collectionGroup,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  where,
  query,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import {
  municipalityMembersCollection,
  municipalityMemberDoc,
} from '../firebase/refs/client';
import { villageMemberConverterClient } from '../firebase/converters/villageMemberConverter.client';
import type {
  VillageMemberData,
  VillageMemberRole,
} from '../models/municipality/VillageMemberDataModel';

export async function getVillageMember(
  municipalityId: string,
  userId: string,
): Promise<(VillageMemberData & { id: string }) | null> {
  const snap = await getDoc(municipalityMemberDoc(getDb(), municipalityId, userId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getVillageMembers(
  municipalityId: string,
): Promise<(VillageMemberData & { id: string })[]> {
  const snap = await getDocs(municipalityMembersCollection(getDb(), municipalityId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addVillageMember(
  municipalityId: string,
  userId: string,
  role: VillageMemberRole = 'user',
): Promise<void> {
  const ref = municipalityMemberDoc(getDb(), municipalityId, userId);
  await setDoc(ref, {
    userId,
    role,
    joinedAt: new Date(),
    profileAnswers: {},
    profileCompletedAt: null,
    trustedNewsAuthor: false,
  });
}

export async function removeVillageMember(
  municipalityId: string,
  userId: string,
): Promise<void> {
  await deleteDoc(municipalityMemberDoc(getDb(), municipalityId, userId));
}

export async function isVillageMember(
  municipalityId: string,
  userId: string,
): Promise<boolean> {
  const snap = await getDoc(municipalityMemberDoc(getDb(), municipalityId, userId));
  return snap.exists();
}

export async function isVillageAdmin(
  municipalityId: string,
  userId: string,
): Promise<boolean> {
  const snap = await getDoc(municipalityMemberDoc(getDb(), municipalityId, userId));
  if (!snap.exists()) return false;
  return snap.data().role === 'admin';
}

export interface UserMembership {
  municipalityId: string;
  role: VillageMemberRole;
  joinedAt: Date;
  profileCompletedAt: Date | null;
}

export async function getUserMemberships(userId: string): Promise<UserMembership[]> {
  // collectionGroup doesn't carry the per-collection converter; attach it explicitly.
  const cg = collectionGroup(getDb(), 'members').withConverter(villageMemberConverterClient);
  const q = query(cg, where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs
    .filter((d) => d.ref.parent.parent?.parent.id === 'municipalities')
    .map((d) => {
      const data = d.data();
      const municipalityId = d.ref.parent.parent?.id;
      if (!municipalityId) throw new Error('member doc missing municipality parent');
      return {
        municipalityId,
        role: data.role,
        joinedAt: data.joinedAt,
        profileCompletedAt: data.profileCompletedAt,
      };
    });
}
