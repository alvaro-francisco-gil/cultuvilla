import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
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
import { setActiveMunicipality } from './userService';
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
  barrioId: string | null = null,
): Promise<void> {
  const ref = municipalityMemberDoc(getDb(), municipalityId, userId);
  await setDoc(ref, {
    userId,
    role,
    joinedAt: new Date(),
    profileAnswers: {},
    profileCompletedAt: null,
    trustedNewsAuthor: false,
    barrioId,
  });
}

/**
 * Set the caller's residence barrio within a village they already belong to.
 * `null` means "Todo el pueblo" (whole village). The
 * `syncMemberBarrioToResidence` trigger projects this into the linked person's
 * `municipalityLinks` so the barrio residents list stays consistent. An invalid
 * barrioId (not an approved barrio of this municipality) is normalized to null
 * by that trigger — the picker prevents it on the honest path.
 */
export async function updateVillageMemberBarrio(
  municipalityId: string,
  userId: string,
  barrioId: string | null,
): Promise<void> {
  // Plain (converter-less) ref: a partial single-field update bypasses the
  // converter's full-document parse, matching how other services patch one key.
  await updateDoc(doc(getDb(), 'municipalities', municipalityId, 'members', userId), { barrioId });
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
  barrioId: string | null;
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
        barrioId: data.barrioId,
      };
    });
}
