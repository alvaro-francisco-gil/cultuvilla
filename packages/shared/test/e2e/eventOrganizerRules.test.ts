import { describe, it, beforeEach } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser } from '../helpers/roles';

const getEnv = useRulesTestEnv();
const E = 'e1';
const ORG = 'org1';
const M = 'm1';

async function seed() {
  await getEnv().withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // Event owned by 'boss', with 'boss' in organizerUserIds (new control model)
    await setDoc(doc(db, `events/${E}`), { organizerUserIds: ['boss'], organizerOrgIds: [ORG], municipalityId: M, createdBy: 'boss' });
    await setDoc(doc(db, `municipalities/${M}/members/villageboss`), { role: 'admin', joinedAt: new Date() });
    await setDoc(doc(db, `events/${E}/registrations/r1`), {
      userId: 'alice', personId: 'p', name: 'Alice', status: 'confirmed', position: 1, registeredAt: new Date(), checkedInAt: null, paidAt: null,
    });
    await setDoc(doc(db, `events/${E}/registrationContacts/r1`), { phone: '600', name: 'Alice' });
  });
}

beforeEach(async () => { await seed(); });

describe('firestore.rules — event organizer (contacts, check-in, removal)', () => {
  it('event organizer (in organizerUserIds) can read a registrationContact; a stranger cannot', async () => {
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(getDoc(doc(boss, `events/${E}/registrationContacts/r1`)));
    const stranger = asUser(getEnv(), 'stranger');
    await assertFails(getDoc(doc(stranger, `events/${E}/registrationContacts/r1`)));
  });

  it('village admin can read a registrationContact', async () => {
    const vb = asUser(getEnv(), 'villageboss');
    await assertSucceeds(getDoc(doc(vb, `events/${E}/registrationContacts/r1`)));
  });

  it('organizer can check in a registration; a stranger cannot', async () => {
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(updateDoc(doc(boss, `events/${E}/registrations/r1`), { checkedInAt: new Date() }));
    const stranger = asUser(getEnv(), 'stranger');
    await assertFails(updateDoc(doc(stranger, `events/${E}/registrations/r1`), { checkedInAt: new Date() }));
  });

  it('the registrant themselves can update their own registration', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(updateDoc(doc(alice, `events/${E}/registrations/r1`), { checkedInAt: new Date() }));
  });

  it('organizer can remove a registration; a stranger cannot', async () => {
    const stranger = asUser(getEnv(), 'stranger');
    await assertFails(deleteDoc(doc(stranger, `events/${E}/registrations/r1`)));
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(deleteDoc(doc(boss, `events/${E}/registrations/r1`)));
  });

  it('nobody can write a registrationContact from the client', async () => {
    const boss = asUser(getEnv(), 'boss');
    await assertFails(setDoc(doc(boss, `events/${E}/registrationContacts/r2`), { phone: '1' }));
  });

  it('organizer can mark a registration paid; a stranger cannot', async () => {
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(updateDoc(doc(boss, `events/${E}/registrations/r1`), { paidAt: new Date() }));
    const stranger = asUser(getEnv(), 'stranger');
    await assertFails(updateDoc(doc(stranger, `events/${E}/registrations/r1`), { paidAt: new Date() }));
  });

  it('the registrant themselves CANNOT mark their own registration paid', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertFails(updateDoc(doc(alice, `events/${E}/registrations/r1`), { paidAt: new Date() }));
  });

  it('village admin can mark a registration paid', async () => {
    const vb = asUser(getEnv(), 'villageboss');
    await assertSucceeds(updateDoc(doc(vb, `events/${E}/registrations/r1`), { paidAt: new Date() }));
  });
});
