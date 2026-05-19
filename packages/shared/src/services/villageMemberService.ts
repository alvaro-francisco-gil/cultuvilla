import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  where,
  query,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import type { VillageMemberData, VillageMemberRole } from '../models/municipality/VillageMemberDataModel';
import type { ProfileAnswers } from '../models/municipality/CensoTypes';

function membersCol(municipalityId: string) {
  return collection(getDb(), 'municipalities', municipalityId, 'members');
}

function mapMemberDoc(
  id: string,
  data: Record<string, unknown>,
): VillageMemberData & { id: string } {
  const completedAtRaw = data['profileCompletedAt'];
  return {
    id,
    role: data['role'] as VillageMemberRole,
    joinedAt: (data['joinedAt'] as Timestamp).toDate(),
    profileAnswers: ((data['profileAnswers'] as ProfileAnswers) ?? {}) as ProfileAnswers,
    profileCompletedAt: completedAtRaw ? (completedAtRaw as Timestamp).toDate() : null,
  };
}

export async function getVillageMember(
  municipalityId: string,
  userId: string
): Promise<(VillageMemberData & { id: string }) | null> {
  const snap = await getDoc(doc(membersCol(municipalityId), userId));
  if (!snap.exists()) return null;
  return mapMemberDoc(snap.id, snap.data());
}

export async function getVillageMembers(
  municipalityId: string
): Promise<(VillageMemberData & { id: string })[]> {
  const snap = await getDocs(membersCol(municipalityId));
  return snap.docs.map((d) => mapMemberDoc(d.id, d.data()));
}

export async function addVillageMember(
  municipalityId: string,
  userId: string,
  role: VillageMemberRole = 'user'
): Promise<void> {
  await setDoc(doc(membersCol(municipalityId), userId), {
    userId,
    role,
    joinedAt: serverTimestamp(),
    profileAnswers: {},
    profileCompletedAt: null,
  });
}

export async function removeVillageMember(
  municipalityId: string,
  userId: string
): Promise<void> {
  await deleteDoc(doc(membersCol(municipalityId), userId));
}

export async function isVillageMember(
  municipalityId: string,
  userId: string
): Promise<boolean> {
  const snap = await getDoc(doc(membersCol(municipalityId), userId));
  return snap.exists();
}

export async function isVillageAdmin(
  municipalityId: string,
  userId: string
): Promise<boolean> {
  const snap = await getDoc(doc(membersCol(municipalityId), userId));
  if (!snap.exists()) return false;
  return snap.data()['role'] === 'admin';
}

export interface UserMembership {
  municipalityId: string;
  role: VillageMemberRole;
  joinedAt: Date;
  profileCompletedAt: Date | null;
}

export async function getUserMemberships(userId: string): Promise<UserMembership[]> {
  const q = query(collectionGroup(getDb(), 'members'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs
    .filter((d) => d.ref.parent.parent?.parent.id === 'municipalities')
    .map((d) => {
      const data = d.data();
      const completedAtRaw = data['profileCompletedAt'];
      return {
        municipalityId: d.ref.parent.parent!.id,
        role: data['role'] as VillageMemberRole,
        joinedAt: (data['joinedAt'] as Timestamp).toDate(),
        profileCompletedAt: completedAtRaw ? (completedAtRaw as Timestamp).toDate() : null,
      };
    });
}
