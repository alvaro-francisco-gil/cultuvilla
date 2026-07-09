import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  where,
  query,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDb, getFirebaseFunctions } from '../firebase';
import {
  municipalityMembersCollection,
  municipalityMemberDoc,
} from '../firebase/refs/client';
import { villageMemberConverterClient } from '../firebase/converters/villageMemberConverter.client';
import { buildVillageMemberData } from '../models/municipality/VillageMemberDataModel';
import { buildResidenceLinks } from '../models/person/PersonDataModel';
import { setActiveMunicipality } from './userService';
import { getPersonByUserId } from './personService';
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

/**
 * Join a village as the calling user and make it their active village.
 *
 * Residence is single-source-of-truth on the caller's person doc, so the member
 * doc and the residence link are written in one atomic `writeBatch` — no
 * eventual-consistency window (barrio residency shows up the instant the join
 * lands). `barrioId` is the chosen residence within the village (`null` = whole
 * village). Both docs are owner-writable, so the batch passes Firestore rules.
 *
 * The residence link is written via `buildResidenceLinks`, the single constructor
 * of the exact `{ municipalityId, barrioId }` shape that `getPersonsByBarrio`
 * matches on. If the caller has no person doc yet, only the membership is created
 * (residence gets set when their person exists) — but the self-service join
 * surfaces always run post-onboarding, so a person is present in practice.
 *
 * Also patches users/{userId}.activeMunicipalityId so the Pueblo tab immediately
 * surfaces the joined village.
 */
export async function joinVillage(
  municipalityId: string,
  userId: string,
  barrioId: string | null = null,
): Promise<void> {
  const db = getDb();
  const person = await getPersonByUserId(userId);

  const batch = writeBatch(db);
  batch.set(
    municipalityMemberDoc(db, municipalityId, userId),
    buildVillageMemberData({ userId, role: 'user' }),
  );
  if (person) {
    const others = person.municipalityLinks.filter((l) => l.municipalityId !== municipalityId);
    // Raw doc ref: batch.update takes field paths, bypassing the converter.
    batch.update(doc(db, 'persons', person.id), {
      municipalityLinks: [...others, ...buildResidenceLinks(municipalityId, barrioId)],
    });
  }
  await batch.commit();

  await setActiveMunicipality(userId, municipalityId);
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

/**
 * Promote/demote a village member's role. The ONLY way to create (or remove) a
 * village admin — a thin wrapper over the `changeVillageMemberRole` callable,
 * which checks caller authority, updates the role, and writes a
 * `membershipEvents` audit record in one transaction. Clients can no longer
 * write `role` directly (firestore.rules makes it function-owned), so there is
 * no non-audited path.
 */
export async function setVillageMemberRole(
  municipalityId: string,
  userId: string,
  role: VillageMemberRole,
): Promise<void> {
  const fn = httpsCallable<
    { municipalityId: string; targetUserId: string; role: VillageMemberRole },
    { ok: true }
  >(getFirebaseFunctions(), 'changeVillageMemberRole');
  await fn({ municipalityId, targetUserId: userId, role });
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
