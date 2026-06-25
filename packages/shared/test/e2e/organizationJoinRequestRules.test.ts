// packages/shared/test/e2e/organizationJoinRequestRules.test.ts
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;
const ORG = 'org1', MID = 'mun1', REQUESTER = 'alice', ADMIN = 'creator', OUTSIDER = 'bob', APP = 'sadmin';

async function seedOrg() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `organizations/${ORG}`), { municipalityId: MID, status: 'approved', requestedBy: ADMIN, name: 'P', description: null, imageURL: null, type: 'peña', reviewedBy: 'x', createdAt: new Date(), reviewedAt: new Date() });
    await setDoc(doc(db, `organizations/${ORG}/members/${ADMIN}`), { joinedAt: new Date(), role: 'admin' });
    await setDoc(doc(db, `admins/${APP}`), { createdAt: new Date() });
  });
}
function reqDoc() {
  return { userId: REQUESTER, orgId: ORG, municipalityId: MID, status: 'pending', requestedAt: new Date(), reviewedAt: null, reviewedBy: null };
}

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'cultuvilla-rules-test', firestore: { rules } });
});
beforeEach(async () => { await env.clearFirestore(); await seedOrg(); });
afterAll(async () => { await env.cleanup(); });

describe('/organizationJoinRequests', () => {
  it('a user can create their own pending request', async () => {
    const db = env.authenticatedContext(REQUESTER).firestore();
    await assertSucceeds(setDoc(doc(db, 'organizationJoinRequests/r1'), reqDoc()));
  });
  it('a user cannot create a request for someone else', async () => {
    const db = env.authenticatedContext(OUTSIDER).firestore();
    await assertFails(setDoc(doc(db, 'organizationJoinRequests/r1'), reqDoc()));
  });
  it('a non-pending create is rejected', async () => {
    const db = env.authenticatedContext(REQUESTER).firestore();
    await assertFails(setDoc(doc(db, 'organizationJoinRequests/r1'), { ...reqDoc(), status: 'approved' }));
  });
  it('an unknown field is rejected', async () => {
    const db = env.authenticatedContext(REQUESTER).firestore();
    await assertFails(setDoc(doc(db, 'organizationJoinRequests/r1'), { ...reqDoc(), evil: 1 }));
  });
  it('the org admin can read a request', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'organizationJoinRequests/r1'), reqDoc()));
    const db = env.authenticatedContext(ADMIN).firestore();
    await assertSucceeds(getDoc(doc(db, 'organizationJoinRequests/r1')));
  });
  it('an outsider cannot read a request', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'organizationJoinRequests/r1'), reqDoc()));
    const db = env.authenticatedContext(OUTSIDER).firestore();
    await assertFails(getDoc(doc(db, 'organizationJoinRequests/r1')));
  });
  it('no client may flip status (callable-only)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'organizationJoinRequests/r1'), reqDoc()));
    const db = env.authenticatedContext(ADMIN).firestore();
    await assertFails(updateDoc(doc(db, 'organizationJoinRequests/r1'), { status: 'approved' }));
  });
});
