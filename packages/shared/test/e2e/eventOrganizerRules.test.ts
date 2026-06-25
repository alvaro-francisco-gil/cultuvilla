import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;
const E = 'e1';
const ORG = 'org1';
const M = 'm1';

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // Event owned by 'boss', with 'boss' in organizerUserIds (new control model)
    await setDoc(doc(db, `events/${E}`), { organizerUserIds: ['boss'], organizerOrgIds: [ORG], municipalityId: M, createdBy: 'boss' });
    await setDoc(doc(db, `municipalities/${M}/members/villageboss`), { role: 'admin', joinedAt: new Date() });
    await setDoc(doc(db, `events/${E}/registrations/r1`), {
      userId: 'alice', personId: 'p', name: 'Alice', status: 'confirmed', position: 1, registeredAt: new Date(), checkedInAt: null,
    });
    await setDoc(doc(db, `events/${E}/registrationContacts/r1`), { phone: '600', name: 'Alice' });
  });
}

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({
    projectId: process.env.TEST_PROJECT_ID || 'cultuvilla-rules-test',
    firestore: { rules },
  });
});
beforeEach(async () => { await env.clearFirestore(); await seed(); });
afterAll(async () => { await env.cleanup(); });

describe('firestore.rules — event organizer (contacts, check-in, removal)', () => {
  it('event organizer (in organizerUserIds) can read a registrationContact; a stranger cannot', async () => {
    const boss = env.authenticatedContext('boss').firestore();
    await assertSucceeds(getDoc(doc(boss, `events/${E}/registrationContacts/r1`)));
    const stranger = env.authenticatedContext('stranger').firestore();
    await assertFails(getDoc(doc(stranger, `events/${E}/registrationContacts/r1`)));
  });

  it('village admin can read a registrationContact', async () => {
    const vb = env.authenticatedContext('villageboss').firestore();
    await assertSucceeds(getDoc(doc(vb, `events/${E}/registrationContacts/r1`)));
  });

  it('organizer can check in a registration; a stranger cannot', async () => {
    const boss = env.authenticatedContext('boss').firestore();
    await assertSucceeds(updateDoc(doc(boss, `events/${E}/registrations/r1`), { checkedInAt: new Date() }));
    const stranger = env.authenticatedContext('stranger').firestore();
    await assertFails(updateDoc(doc(stranger, `events/${E}/registrations/r1`), { checkedInAt: new Date() }));
  });

  it('the registrant themselves can update their own registration', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(updateDoc(doc(alice, `events/${E}/registrations/r1`), { checkedInAt: new Date() }));
  });

  it('organizer can remove a registration; a stranger cannot', async () => {
    const stranger = env.authenticatedContext('stranger').firestore();
    await assertFails(deleteDoc(doc(stranger, `events/${E}/registrations/r1`)));
    const boss = env.authenticatedContext('boss').firestore();
    await assertSucceeds(deleteDoc(doc(boss, `events/${E}/registrations/r1`)));
  });

  it('nobody can write a registrationContact from the client', async () => {
    const boss = env.authenticatedContext('boss').firestore();
    await assertFails(setDoc(doc(boss, `events/${E}/registrationContacts/r2`), { phone: '1' }));
  });
});
