// Firestore Rules e2e test for /_admin/** — the backfill registry's completion
// markers (`_admin/backfills/markers/{id}`) and any operational state added
// later. The Admin SDK bypasses rules, so the backfill harness writes these
// fine; no client may read or write them, including an app admin.
//
// A marker is the source of truth the deploy gate reads to decide whether an
// env's data is ready. Client-writable markers would let anyone mark a
// migration "done" and wave a nonconforming schema straight through the gate.
import { describe, it } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asAdmin, asAnon, asUser, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();

const MARKER_PATH = '_admin/backfills/markers/some-backfill';

const markerPayload = () => ({
  dev: { completedAt: new Date(), gitSha: 'abc123', actor: 'ci', counts: { patched: 3, total: 10 } },
});

const seedMarker = () =>
  seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), MARKER_PATH), markerPayload());
  });

describe('firestore.rules — /_admin/**', () => {
  it('denies an anonymous client reading a backfill marker', async () => {
    await seedMarker();
    await assertFails(getDoc(doc(asAnon(getEnv()), MARKER_PATH)));
  });

  it('denies an authenticated user reading a backfill marker', async () => {
    await seedMarker();
    await assertFails(getDoc(doc(asUser(getEnv(), 'uid-1'), MARKER_PATH)));
  });

  it('denies an app admin reading a backfill marker', async () => {
    // Operational state is server-only — being an app admin is not a bypass.
    await seedMarker();
    const adminDb = await asAdmin(getEnv(), 'uid-admin');
    await assertFails(getDoc(doc(adminDb, MARKER_PATH)));
  });

  it('denies a client listing the markers collection', async () => {
    await seedMarker();
    await assertFails(getDocs(collection(asUser(getEnv(), 'uid-1'), '_admin/backfills/markers')));
  });

  it('denies a client forging a marker', async () => {
    // The gate reads this doc to decide a migration ran. A client-written
    // marker would wave a nonconforming schema straight through the deploy.
    await assertFails(setDoc(doc(asUser(getEnv(), 'uid-1'), MARKER_PATH), markerPayload()));
  });

  it('denies a client overwriting or deleting an existing marker', async () => {
    await seedMarker();
    const userDb = asUser(getEnv(), 'uid-1');
    await assertFails(setDoc(doc(userDb, MARKER_PATH), { dev: { actor: 'attacker' } }));
    await assertFails(deleteDoc(doc(userDb, MARKER_PATH)));
  });

  it('denies clients at any other _admin path', async () => {
    // The rule is a recursive wildcard, so future operational state is covered
    // without a new rule per path.
    const userDb = asUser(getEnv(), 'uid-1');
    await assertFails(getDoc(doc(userDb, '_admin/anything')));
    await assertFails(setDoc(doc(userDb, '_admin/backfills/cursors/some-cursor'), { at: 1 }));
  });

  it('denies every client reading the store-review sign-in credential', async () => {
    // _admin/reviewAccess holds the allowlisted address and the fixed OTP code
    // for the store reviewer. The recursive wildcard already covers it; this
    // asserts it by name because a readable copy of that pair is a working
    // sign-in for anyone, not merely leaked operational state.
    await seed(getEnv(), async (ctx) => {
      await setDoc(doc(ctx.firestore(), '_admin/reviewAccess'), {
        email: 'review@example.com',
        code: '424242',
      });
    });

    await assertFails(getDoc(doc(asAnon(getEnv()), '_admin/reviewAccess')));
    await assertFails(getDoc(doc(asUser(getEnv(), 'uid-1'), '_admin/reviewAccess')));
    await assertFails(getDoc(doc(await asAdmin(getEnv(), 'uid-admin'), '_admin/reviewAccess')));
    await assertFails(
      setDoc(doc(asUser(getEnv(), 'uid-1'), '_admin/reviewAccess'), { email: 'a@b.c', code: '000000' }),
    );
  });

  it('still allows the admin SDK (rules bypassed) to write a marker', async () => {
    // Sanity check that the harness's own writes are not what we just blocked.
    await assertSucceeds(seedMarker());
  });

  // The OSM settlement dataset lives under the same deny-all, which is the whole
  // reason it was put there: it is reference data no client reads, so it needs
  // no rules of its own and cannot be edited into a village's seeded barrios.
  describe('settlement seeds', () => {
    const SEED_PATH = '_admin/settlements/seeds/49069';
    const seedSettlements = () =>
      seed(getEnv(), async (ctx) => {
        await setDoc(doc(ctx.firestore(), SEED_PATH), {
          codigoINE: '49069',
          name: 'Figueruela de Arriba',
          settlements: [
            { name: 'Villarino de Manzanas', kind: 'pedania', isSeat: false, lat: null, lng: null },
          ],
        });
      });

    it('denies an anonymous client reading a settlement seed', async () => {
      await seedSettlements();
      await assertFails(getDoc(doc(asAnon(getEnv()), SEED_PATH)));
    });

    it('denies an authenticated user reading a settlement seed', async () => {
      await seedSettlements();
      await assertFails(getDoc(doc(asUser(getEnv(), 'uid-1'), SEED_PATH)));
    });

    it('denies an app admin reading a settlement seed', async () => {
      await seedSettlements();
      const adminDb = await asAdmin(getEnv(), 'boss');
      await assertFails(getDoc(doc(adminDb, SEED_PATH)));
    });

    it('denies a client writing a settlement seed', async () => {
      // A writable seed would let anyone inject arbitrary barrios into every
      // village activated afterwards.
      await assertFails(
        setDoc(doc(asUser(getEnv(), 'uid-1'), SEED_PATH), {
          codigoINE: '49069',
          name: 'x',
          settlements: [],
        }),
      );
    });

    it('denies a client deleting a settlement seed', async () => {
      await seedSettlements();
      await assertFails(deleteDoc(doc(asUser(getEnv(), 'uid-1'), SEED_PATH)));
    });
  });
});
