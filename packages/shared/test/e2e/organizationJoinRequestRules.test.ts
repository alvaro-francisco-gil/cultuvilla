// packages/shared/test/e2e/organizationJoinRequestRules.test.ts
import { describe, it, beforeEach } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();
const ORG = 'org1', MID = 'mun1', REQUESTER = 'alice', ADMIN = 'creator', OUTSIDER = 'bob', APP = 'sadmin';

async function seedOrg() {
  await seed(getEnv(), async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `organizations/${ORG}`), { municipalityId: MID, status: 'approved', requestedBy: ADMIN, name: 'P', description: null, imageURL: null, type: 'peña', reviewedBy: 'x', createdAt: new Date(), reviewedAt: new Date() });
    await setDoc(doc(db, `organizations/${ORG}/members/${ADMIN}`), { joinedAt: new Date(), role: 'admin' });
    await setDoc(doc(db, `admins/${APP}`), { createdAt: new Date() });
  });
}
function reqDoc() {
  return { userId: REQUESTER, orgId: ORG, municipalityId: MID, status: 'pending', requestedAt: new Date(), reviewedAt: null, reviewedBy: null };
}

beforeEach(async () => { await seedOrg(); });

describe('/organizationJoinRequests', () => {
  it('a user can create their own pending request', async () => {
    const db = asUser(getEnv(), REQUESTER);
    await assertSucceeds(setDoc(doc(db, 'organizationJoinRequests/r1'), reqDoc()));
  });
  it('a user cannot create a request for someone else', async () => {
    const db = asUser(getEnv(), OUTSIDER);
    await assertFails(setDoc(doc(db, 'organizationJoinRequests/r1'), reqDoc()));
  });
  it('a non-pending create is rejected', async () => {
    const db = asUser(getEnv(), REQUESTER);
    await assertFails(setDoc(doc(db, 'organizationJoinRequests/r1'), { ...reqDoc(), status: 'approved' }));
  });
  it('an unknown field is rejected', async () => {
    const db = asUser(getEnv(), REQUESTER);
    await assertFails(setDoc(doc(db, 'organizationJoinRequests/r1'), { ...reqDoc(), evil: 1 }));
  });
  it('the org admin can read a request', async () => {
    await seed(getEnv(), async (ctx) => setDoc(doc(ctx.firestore(), 'organizationJoinRequests/r1'), reqDoc()));
    const db = asUser(getEnv(), ADMIN);
    await assertSucceeds(getDoc(doc(db, 'organizationJoinRequests/r1')));
  });
  it('an outsider cannot read a request', async () => {
    await seed(getEnv(), async (ctx) => setDoc(doc(ctx.firestore(), 'organizationJoinRequests/r1'), reqDoc()));
    const db = asUser(getEnv(), OUTSIDER);
    await assertFails(getDoc(doc(db, 'organizationJoinRequests/r1')));
  });
  it('no client may flip status (callable-only)', async () => {
    await seed(getEnv(), async (ctx) => setDoc(doc(ctx.firestore(), 'organizationJoinRequests/r1'), reqDoc()));
    const db = asUser(getEnv(), ADMIN);
    await assertFails(updateDoc(doc(db, 'organizationJoinRequests/r1'), { status: 'approved' }));
  });
});
