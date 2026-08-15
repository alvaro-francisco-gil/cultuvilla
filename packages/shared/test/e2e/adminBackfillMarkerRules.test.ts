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

  it('still allows the admin SDK (rules bypassed) to write a marker', async () => {
    // Sanity check that the harness's own writes are not what we just blocked.
    await assertSucceeds(seedMarker());
  });
});
