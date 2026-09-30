// Firestore Rules e2e test for municipalities/{id}/inviteTokens/{tokenId}.
// A token id is the invite secret: fetching one you already hold is fine,
// enumerating a village's tokens is for its admins only.
import { describe, it } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asAdmin, asAnon, asUser, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();

const MUNI = 'muni-1';
const TOKEN = 'tok-1';
const VILLAGE_ADMIN = 'vadmin';
const VILLAGER = 'villager';

async function seedVillage() {
  await seed(getEnv(), async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `municipalities/${MUNI}`), { communityActive: true });
    await setDoc(doc(db, `municipalities/${MUNI}/members/${VILLAGE_ADMIN}`), {
      userId: VILLAGE_ADMIN,
      role: 'admin',
    });
    await setDoc(doc(db, `municipalities/${MUNI}/members/${VILLAGER}`), {
      userId: VILLAGER,
      role: 'user',
    });
    await setDoc(doc(db, `municipalities/${MUNI}/inviteTokens/${TOKEN}`), {
      createdAt: new Date(),
      expiresAt: null,
      usageCount: 0,
    });
  });
}

const tokens = `municipalities/${MUNI}/inviteTokens`;

describe('firestore.rules — inviteTokens listing is admin-only', () => {
  it('lets anyone holding a token id get that one token', async () => {
    await seedVillage();
    await assertSucceeds(getDoc(doc(asAnon(getEnv()), `${tokens}/${TOKEN}`)));
  });

  it('denies a signed-out list', async () => {
    await seedVillage();
    await assertFails(getDocs(collection(asAnon(getEnv()), tokens)));
  });

  it('denies a list by a plain villager', async () => {
    await seedVillage();
    await assertFails(getDocs(collection(asUser(getEnv(), VILLAGER), tokens)));
  });

  it('allows the village admin to list', async () => {
    await seedVillage();
    await assertSucceeds(getDocs(collection(asUser(getEnv(), VILLAGE_ADMIN), tokens)));
  });

  it('allows an app admin to list', async () => {
    await seedVillage();
    const adminDb = await asAdmin(getEnv(), 'sadmin');
    await assertSucceeds(getDocs(collection(adminDb, tokens)));
  });
});
