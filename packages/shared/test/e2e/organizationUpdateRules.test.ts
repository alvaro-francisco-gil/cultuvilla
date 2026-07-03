// Firestore Rules e2e test for the /organizations/{orgId} update + delete path.
//
// Fills a real coverage gap: approving/rejecting an org proposal is done
// client-side by the `approveOrganization` / `rejectOrganization` service
// functions (plain `updateDoc` writes, no Cloud Function), so the ONLY gate on
// those writes is `firestore.rules`. The rule is:
//   allow update: if isVillageAdmin(resource.data.municipalityId) || isAppAdmin();
//   allow delete: if isVillageAdmin(resource.data.municipalityId) || isAppAdmin();
// where isVillageAdmin(mid) requires a `municipalities/{mid}/members/{uid}` doc
// with `role == 'admin'`, and isAppAdmin requires an `admins/{uid}` doc.
//
// Uses @firebase/rules-unit-testing to mount the live firestore.rules file
// against the firestore emulator and execute the writes under different auth
// contexts. We assert the RULE allows/denies each write — not the service.
import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, asAnon, asAdmin, seed } from '../helpers/roles';
import { buildOrganizationData } from '../../src/models/organization/OrganizationDataModel';

const getEnv = useRulesTestEnv();

const ORG_ID = 'o1';
const MID = 'mun1';
const VILLAGE_ADMIN = 'vadmin';
const VILLAGE_MEMBER = 'vmember';
const OTHER_USER = 'stranger';
const APP_ADMIN = 'sadmin';

// Mirrors what approveOrganization writes: { status, reviewedBy, reviewedAt }.
const approvePatch = { status: 'approved', reviewedBy: VILLAGE_ADMIN, reviewedAt: new Date() };
// Mirrors what rejectOrganization writes.
const rejectPatch = { status: 'rejected' };

async function seedOrgAndMembers() {
  await seed(getEnv(), async (ctx) => {
    const db = ctx.firestore();
    await setDoc(
      doc(db, `organizations/${ORG_ID}`),
      buildOrganizationData({
        name: 'Peña Ejemplo',
        type: 'peña',
        status: 'pending',
        municipalityId: MID,
        requestedBy: 'creator',
      }),
    );
    // isVillageAdmin(MID): needs a members doc with role 'admin'.
    await setDoc(doc(db, `municipalities/${MID}/members/${VILLAGE_ADMIN}`), {
      userId: VILLAGE_ADMIN,
      role: 'admin',
      joinedAt: new Date(),
      profileAnswers: {},
      profileCompletedAt: null,
      trustedNewsAuthor: false,
    });
    // A plain (non-admin) member of the same municipality.
    await setDoc(doc(db, `municipalities/${MID}/members/${VILLAGE_MEMBER}`), {
      userId: VILLAGE_MEMBER,
      role: 'member',
      joinedAt: new Date(),
      profileAnswers: {},
      profileCompletedAt: null,
      trustedNewsAuthor: false,
    });
  });
}

describe('firestore.rules — /organizations/{orgId} update + delete', () => {
  describe('update (approve / reject)', () => {
    it('a village admin of the org municipality can approve (pending -> approved)', async () => {
      await seedOrgAndMembers();
      const db = asUser(getEnv(), VILLAGE_ADMIN);
      await assertSucceeds(updateDoc(doc(db, `organizations/${ORG_ID}`), approvePatch));
    });

    it('a village admin can reject (pending -> rejected)', async () => {
      await seedOrgAndMembers();
      const db = asUser(getEnv(), VILLAGE_ADMIN);
      await assertSucceeds(updateDoc(doc(db, `organizations/${ORG_ID}`), rejectPatch));
    });

    it('an app admin can update the org', async () => {
      await seedOrgAndMembers();
      const db = await asAdmin(getEnv(), APP_ADMIN);
      await assertSucceeds(updateDoc(doc(db, `organizations/${ORG_ID}`), approvePatch));
    });

    it('a plain village member (role member, not admin) cannot update', async () => {
      await seedOrgAndMembers();
      const db = asUser(getEnv(), VILLAGE_MEMBER);
      await assertFails(updateDoc(doc(db, `organizations/${ORG_ID}`), approvePatch));
    });

    it('an unrelated authenticated user cannot update', async () => {
      await seedOrgAndMembers();
      const db = asUser(getEnv(), OTHER_USER);
      await assertFails(updateDoc(doc(db, `organizations/${ORG_ID}`), approvePatch));
    });

    it('an anonymous user cannot update', async () => {
      await seedOrgAndMembers();
      const db = asAnon(getEnv());
      await assertFails(updateDoc(doc(db, `organizations/${ORG_ID}`), approvePatch));
    });
  });

  describe('delete', () => {
    it('a village admin of the org municipality can delete', async () => {
      await seedOrgAndMembers();
      const db = asUser(getEnv(), VILLAGE_ADMIN);
      await assertSucceeds(deleteDoc(doc(db, `organizations/${ORG_ID}`)));
    });

    it('a plain village member cannot delete', async () => {
      await seedOrgAndMembers();
      const db = asUser(getEnv(), VILLAGE_MEMBER);
      await assertFails(deleteDoc(doc(db, `organizations/${ORG_ID}`)));
    });
  });
});
