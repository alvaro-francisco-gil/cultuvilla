// packages/shared/test/e2e/orgMemberRules.test.ts
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;
const MID = 'mun1';
const ORG = 'org1';

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `organizations/${ORG}`), {
      name: 'Peña', description: null, imageURL: null, type: 'peña',
      status: 'approved', municipalityId: MID, requestedBy: 'creator',
      approvedBy: 'vadmin', createdAt: new Date(), decidedAt: new Date(),
    });
    await setDoc(doc(db, `organizations/${ORG}/members/creator`), { joinedAt: new Date(), role: 'admin' });
    await setDoc(doc(db, `organizations/${ORG}/members/member1`), { joinedAt: new Date(), role: 'member' });
    await setDoc(doc(db, `municipalities/${MID}/members/vadmin`), { userId: 'vadmin', role: 'admin', joinedAt: new Date(), profileAnswers: {}, profileCompletedAt: null, trustedNewsAuthor: false });
  });
}

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'cultuvilla-rules-test', firestore: { rules } });
});
beforeEach(async () => { await env.clearFirestore(); await seed(); });
afterAll(async () => { await env.cleanup(); });

describe('org members — roles', () => {
  it('an org member can add another member with role member', async () => {
    const db = env.authenticatedContext('member1').firestore();
    await assertSucceeds(setDoc(doc(db, `organizations/${ORG}/members/newbie`), { joinedAt: new Date(), role: 'member' }));
  });

  it('a plain member cannot add an admin', async () => {
    const db = env.authenticatedContext('member1').firestore();
    await assertFails(setDoc(doc(db, `organizations/${ORG}/members/newadmin`), { joinedAt: new Date(), role: 'admin' }));
  });

  it('an org admin can promote a member (update role)', async () => {
    const db = env.authenticatedContext('creator').firestore();
    await assertSucceeds(updateDoc(doc(db, `organizations/${ORG}/members/member1`), { role: 'admin' }));
  });

  it('a plain member cannot change roles', async () => {
    const db = env.authenticatedContext('member1').firestore();
    await assertFails(updateDoc(doc(db, `organizations/${ORG}/members/creator`), { role: 'member' }));
  });

  it('an org admin can remove a member', async () => {
    const db = env.authenticatedContext('creator').firestore();
    await assertSucceeds(deleteDoc(doc(db, `organizations/${ORG}/members/member1`)));
  });

  it('a member can remove themselves', async () => {
    const db = env.authenticatedContext('member1').firestore();
    await assertSucceeds(deleteDoc(doc(db, `organizations/${ORG}/members/member1`)));
  });

  it('a doc with an unknown field is rejected on create', async () => {
    const db = env.authenticatedContext('member1').firestore();
    await assertFails(setDoc(doc(db, `organizations/${ORG}/members/newbie`), { joinedAt: new Date(), role: 'member', evil: true }));
  });
});
