// packages/shared/test/e2e/orgMemberRules.test.ts
import { describe, it, beforeEach } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser } from '../helpers/roles';

const getEnv = useRulesTestEnv();
const MID = 'mun1';
const ORG = 'org1';

async function seed() {
  await getEnv().withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `organizations/${ORG}`), {
      name: 'Peña', description: null, imageURL: null, type: 'peña',
      status: 'approved', municipalityId: MID, requestedBy: 'creator',
      reviewedBy: 'vadmin', createdAt: new Date(), reviewedAt: new Date(),
    });
    await setDoc(doc(db, `organizations/${ORG}/members/creator`), { joinedAt: new Date(), role: 'admin' });
    await setDoc(doc(db, `organizations/${ORG}/members/member1`), { joinedAt: new Date(), role: 'member' });
    await setDoc(doc(db, `municipalities/${MID}/members/vadmin`), { userId: 'vadmin', role: 'admin', joinedAt: new Date(), profileAnswers: {}, profileCompletedAt: null, trustedNewsAuthor: false });
  });
}

beforeEach(async () => { await seed(); });

describe('org members — roles', () => {
  it('an org member can add another member with role member', async () => {
    const db = asUser(getEnv(), 'member1');
    await assertSucceeds(setDoc(doc(db, `organizations/${ORG}/members/newbie`), { joinedAt: new Date(), role: 'member' }));
  });

  it('a plain member cannot add an admin', async () => {
    const db = asUser(getEnv(), 'member1');
    await assertFails(setDoc(doc(db, `organizations/${ORG}/members/newadmin`), { joinedAt: new Date(), role: 'admin' }));
  });

  it('an org admin can promote a member (update role)', async () => {
    const db = asUser(getEnv(), 'creator');
    await assertSucceeds(updateDoc(doc(db, `organizations/${ORG}/members/member1`), { role: 'admin' }));
  });

  it('a plain member cannot change roles', async () => {
    const db = asUser(getEnv(), 'member1');
    await assertFails(updateDoc(doc(db, `organizations/${ORG}/members/creator`), { role: 'member' }));
  });

  it('an org admin can remove a member', async () => {
    const db = asUser(getEnv(), 'creator');
    await assertSucceeds(deleteDoc(doc(db, `organizations/${ORG}/members/member1`)));
  });

  it('a member can remove themselves', async () => {
    const db = asUser(getEnv(), 'member1');
    await assertSucceeds(deleteDoc(doc(db, `organizations/${ORG}/members/member1`)));
  });

  it('a doc with an unknown field is rejected on create', async () => {
    const db = asUser(getEnv(), 'member1');
    await assertFails(setDoc(doc(db, `organizations/${ORG}/members/newbie`), { joinedAt: new Date(), role: 'member', evil: true }));
  });
});
