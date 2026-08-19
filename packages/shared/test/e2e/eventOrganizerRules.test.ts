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
    await setDoc(doc(db, `events/${E}/registrationPrivate/r1`), { phone: '600', name: 'Alice', answers: { f1: 'M' } });
  });
}

beforeEach(async () => { await seed(); });

describe('firestore.rules — event organizer (contacts, check-in, removal)', () => {
  it('event organizer (in organizerUserIds) can read a registrationPrivate doc; a stranger cannot', async () => {
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(getDoc(doc(boss, `events/${E}/registrationPrivate/r1`)));
    const stranger = asUser(getEnv(), 'stranger');
    await assertFails(getDoc(doc(stranger, `events/${E}/registrationPrivate/r1`)));
  });

  it('village admin can read a registrationPrivate doc', async () => {
    const vb = asUser(getEnv(), 'villageboss');
    await assertSucceeds(getDoc(doc(vb, `events/${E}/registrationPrivate/r1`)));
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

  it('nobody deletes a registration from the client — not even the organizer', async () => {
    // Cancellation moved into the cancelRegistration callable: a group is
    // atomic, and rules can neither read the sibling seats nor require the
    // companion deletes, so no client delete can be trusted.
    for (const uid of ['stranger', 'alice', 'boss', 'villageboss']) {
      const db = asUser(getEnv(), uid);
      await assertFails(deleteDoc(doc(db, `events/${E}/registrations/r1`)));
    }
  });

  it('nobody can write a registrationPrivate doc from the client', async () => {
    const boss = asUser(getEnv(), 'boss');
    await assertFails(setDoc(doc(boss, `events/${E}/registrationPrivate/r2`), { phone: '1' }));
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

// Once answers exist they are keyed by the current field ids, so the list may
// only grow. Rules enforce the size half of that (no loops for per-entry
// checks) — see isAdditiveSignupFieldsChange in firestore.rules.
describe('firestore.rules — signupFields are additive once an event has signups', () => {
  const field = (id: string) => ({ id, label: 'Talla', type: 'text', required: false, options: [] });

  async function seedEventWith(totalCount: number, signupFields: unknown[]) {
    await getEnv().withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `events/${E}`), {
        organizerUserIds: ['boss'], organizerOrgIds: [], municipalityId: M,
        createdBy: 'boss', totalCount, signupFields,
      });
    });
  }

  it('lets an organizer add a field to an event that has signups', async () => {
    await seedEventWith(1, [field('a')]);
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(
      updateDoc(doc(boss, `events/${E}`), { signupFields: [field('a'), field('b')] }),
    );
  });

  it('blocks removing a field once the event has signups', async () => {
    await seedEventWith(1, [field('a'), field('b')]);
    const boss = asUser(getEnv(), 'boss');
    await assertFails(updateDoc(doc(boss, `events/${E}`), { signupFields: [field('a')] }));
  });

  it('allows removing a field while the event still has no signups', async () => {
    await seedEventWith(0, [field('a'), field('b')]);
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(updateDoc(doc(boss, `events/${E}`), { signupFields: [field('a')] }));
  });
});
