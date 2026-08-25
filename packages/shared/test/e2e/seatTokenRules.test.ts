import { describe, it, beforeEach } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser } from '../helpers/roles';

const getEnv = useRulesTestEnv();
const E = 'e1';
const M = 'm1';
const TOKEN = 'tok_aaaaaaaaaaaaaaaaaaaa';

async function seed() {
  await getEnv().withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `events/${E}`), {
      organizerUserIds: ['boss'],
      organizerOrgIds: [],
      municipalityId: M,
      createdBy: 'boss',
      attendeesVisibility: 'members',
      totalCount: 2,
      signupGroupSize: 2, minBirthYear: null, maxBirthYear: null,
    });
    await setDoc(doc(db, `municipalities/${M}/members/villageboss`), { role: 'admin', joinedAt: new Date() });
    await setDoc(doc(db, `municipalities/${M}/members/alice`), { role: 'user', joinedAt: new Date() });
    await setDoc(doc(db, `municipalities/${M}/members/mallory`), { role: 'user', joinedAt: new Date() });
    // Alice booked a pareja: her own seat plus one open seat.
    await setDoc(doc(db, `events/${E}/registrations/r1`), {
      userId: 'alice', personId: 'p1', name: 'Alice', status: 'confirmed', position: 1,
      registeredAt: new Date(), checkedInAt: null, paidAt: null, isMember: true,
      groupId: 'g1', groupOwnerId: 'alice', isOpenSeat: false,
    });
    await setDoc(doc(db, `events/${E}/registrations/r2`), {
      userId: 'alice', personId: '', name: 'Plaza libre', status: 'confirmed', position: 2,
      registeredAt: new Date(), checkedInAt: null, paidAt: null, isMember: false,
      groupId: 'g1', groupOwnerId: 'alice', isOpenSeat: true,
    });
    await setDoc(doc(db, `events/${E}/seatTokens/${TOKEN}`), {
      registrationId: 'r2', groupId: 'g1', createdBy: 'alice',
      createdAt: new Date(), consumedAt: null, consumedBy: null,
    });
  });
}

beforeEach(async () => { await seed(); });

describe('firestore.rules — seatTokens', () => {
  it('the group owner can read their own token to re-share the link', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(getDoc(doc(alice, `events/${E}/seatTokens/${TOKEN}`)));
  });

  it('the event organizer can read a token', async () => {
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(getDoc(doc(boss, `events/${E}/seatTokens/${TOKEN}`)));
  });

  it('a stranger who somehow guessed the id still cannot read it', async () => {
    // The token IS the authorization; a readable token is a claimable seat.
    const mallory = asUser(getEnv(), 'mallory');
    await assertFails(getDoc(doc(mallory, `events/${E}/seatTokens/${TOKEN}`)));
  });

  it('an unscoped list is rejected — only your own tokens are queryable', async () => {
    const mallory = asUser(getEnv(), 'mallory');
    await assertFails(getDocs(collection(mallory, `events/${E}/seatTokens`)));
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(
      getDocs(query(collection(alice, `events/${E}/seatTokens`), where('createdBy', '==', 'alice'))),
    );
    // Filtering to someone else's tokens does not smuggle them out either.
    await assertFails(
      getDocs(query(collection(alice, `events/${E}/seatTokens`), where('createdBy', '==', 'boss'))),
    );
  });

  it('nobody mints or consumes a token from the client', async () => {
    for (const uid of ['alice', 'boss', 'villageboss', 'mallory']) {
      const db = asUser(getEnv(), uid);
      await assertFails(
        setDoc(doc(db, `events/${E}/seatTokens/tok_bbbbbbbbbbbbbbbbbbbb`), {
          registrationId: 'r2', groupId: 'g1', createdBy: uid,
          createdAt: new Date(), consumedAt: null, consumedBy: null,
        }),
      );
      await assertFails(updateDoc(doc(db, `events/${E}/seatTokens/${TOKEN}`), { consumedBy: uid }));
      await assertFails(deleteDoc(doc(db, `events/${E}/seatTokens/${TOKEN}`)));
    }
  });
});

describe('firestore.rules — registration group fields', () => {
  it('the seat holder cannot detach their seat from its group', async () => {
    // Detaching would escape the cancellation cascade that keeps a group whole.
    const alice = asUser(getEnv(), 'alice');
    await assertFails(updateDoc(doc(alice, `events/${E}/registrations/r1`), { groupId: null }));
  });

  it('the seat holder cannot mark an occupied seat open', async () => {
    // Marking it open would hand a claimable seat to whoever has a link.
    const alice = asUser(getEnv(), 'alice');
    await assertFails(updateDoc(doc(alice, `events/${E}/registrations/r1`), { isOpenSeat: true }));
  });

  it('the seat holder cannot reassign who owns the group', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      updateDoc(doc(alice, `events/${E}/registrations/r1`), { groupOwnerId: 'mallory' }),
    );
  });

  it('the seat holder can still check themselves in', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(
      updateDoc(doc(alice, `events/${E}/registrations/r1`), { checkedInAt: new Date() }),
    );
  });
});

describe('firestore.rules — the group owner can see the seats they booked', () => {
  beforeEach(async () => {
    // Simulate a claim: the guest now holds seat r2, Alice still owns the group.
    await getEnv().withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), `events/${E}/registrations/r2`),
        { userId: 'bruno', personId: 'p9', name: 'Bruno', isOpenSeat: false },
        { merge: true },
      );
      // Organizer-only roster, so village membership grants no read here.
      await setDoc(
        doc(ctx.firestore(), `events/${E}`),
        { attendeesVisibility: 'organizers' },
        { merge: true },
      );
    });
  });

  it('lets the owner list their group even after a guest claimed a seat', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(
      getDocs(
        query(collection(alice, `events/${E}/registrations`), where('groupOwnerId', '==', 'alice')),
      ),
    );
  });

  it('does not let anyone else list a group they did not book', async () => {
    const mallory = asUser(getEnv(), 'mallory');
    await assertFails(
      getDocs(
        query(collection(mallory, `events/${E}/registrations`), where('groupOwnerId', '==', 'alice')),
      ),
    );
    // Nor does the clause open the roster generally.
    await assertFails(getDocs(collection(mallory, `events/${E}/registrations`)));
  });

  it('does not let the guest read the rest of the group', async () => {
    // Bruno holds one seat; that is not authority over Alice's booking.
    const bruno = asUser(getEnv(), 'bruno');
    await assertFails(getDoc(doc(bruno, `events/${E}/registrations/r1`)));
  });
});

describe('firestore.rules — signupGroupSize on the event', () => {
  it('is frozen once anyone has signed up', async () => {
    const boss = asUser(getEnv(), 'boss');
    await assertFails(updateDoc(doc(boss, `events/${E}`), { signupGroupSize: 3 }));
  });

  it('is editable while the event has no sign-ups', async () => {
    await getEnv().withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `events/${E}`), { totalCount: 0 }, { merge: true });
    });
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(updateDoc(doc(boss, `events/${E}`), { signupGroupSize: 3 }));
  });
});
