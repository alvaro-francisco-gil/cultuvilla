import type { Firestore } from 'firebase-admin/firestore';
import { municipalityDoc, organizationDoc } from '@cultuvilla/shared/firebase/refs/admin';

export interface DeletionBlocker {
  scopeType: 'village' | 'org';
  scopeId: string;
  name: string;
}

/**
 * A membership the caller holds with `role === 'admin'`, resolved from the
 * `members` collection-group query — either a village (parent is
 * `municipalities/{id}`) or an org (parent is `organizations/{id}`).
 */
interface AdminMembership {
  scopeType: 'village' | 'org';
  scopeId: string;
}

/**
 * Communities (villages or orgs) where the caller is the SOLE admin — the
 * blockers that must be resolved before the account can be deleted, since
 * deleting the account would otherwise leave the group leaderless.
 *
 * Shared by `checkAccountDeletable` (read-only preview) and `deleteAccount`
 * (Task 7, which re-runs this exact check server-side before deleting).
 */
export async function computeDeletionBlockers(
  db: Firestore,
  uid: string,
): Promise<DeletionBlocker[]> {
  const membershipsSnap = await db
    .collectionGroup('members')
    .where('userId', '==', uid)
    .get();

  const adminMemberships: AdminMembership[] = [];
  for (const doc of membershipsSnap.docs) {
    if (doc.data().role !== 'admin') continue;
    const groupDoc = doc.ref.parent.parent;
    const parentCollection = groupDoc?.parent.id;
    if (!groupDoc) continue;
    if (parentCollection === 'municipalities') {
      adminMemberships.push({ scopeType: 'village', scopeId: groupDoc.id });
    } else if (parentCollection === 'organizations') {
      adminMemberships.push({ scopeType: 'org', scopeId: groupDoc.id });
    }
  }

  const blockers: DeletionBlocker[] = [];
  for (const membership of adminMemberships) {
    const membersRef =
      membership.scopeType === 'village'
        ? municipalityDoc(db, membership.scopeId).collection('members')
        : organizationDoc(db, membership.scopeId).collection('members');

    const adminCountSnap = await membersRef.where('role', '==', 'admin').count().get();
    if (adminCountSnap.data().count !== 1) continue;

    const name = await resolveScopeName(db, membership);
    blockers.push({ scopeType: membership.scopeType, scopeId: membership.scopeId, name });
  }

  return blockers;
}

async function resolveScopeName(
  db: Firestore,
  membership: AdminMembership,
): Promise<string> {
  if (membership.scopeType === 'village') {
    const muniSnap = await municipalityDoc(db, membership.scopeId).get();
    return muniSnap.data()?.name ?? membership.scopeId;
  }
  const orgSnap = await organizationDoc(db, membership.scopeId).get();
  return orgSnap.data()?.name ?? membership.scopeId;
}
