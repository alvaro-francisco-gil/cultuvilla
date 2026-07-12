// Firestore Rules e2e test for top-level /organizerRequests/{requestId}.
// Verifies: the requester (resource.data.userId == auth.uid) and app admins
// can read; other authenticated users and anonymous users cannot. No client
// can create/update/delete — those flows are owned by Cloud Functions via
// the admin SDK.
//
// Uses @firebase/rules-unit-testing to mount the live firestore.rules file
// against the firestore emulator and execute requests under different auth
// contexts.
import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, asAnon, asAdmin, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();

const REQUEST_ID = 'req-1';
const REQUESTER = 'alice';
const OTHER_USER = 'bob';
const APP_ADMIN = 'sadmin';

async function seedOrganizerRequest() {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `organizerRequests/${REQUEST_ID}`), {
      userId: REQUESTER,
      status: 'pending',
      createdAt: new Date(),
    });
  });
}

describe('firestore.rules — /organizerRequests/{requestId}', () => {
  describe('read', () => {
    it('owner (resource.data.userId == auth.uid) can read their own organizerRequest', async () => {
      await seedOrganizerRequest();
      const aliceDb = asUser(getEnv(), REQUESTER);
      await assertSucceeds(getDoc(doc(aliceDb, `organizerRequests/${REQUEST_ID}`)));
    });

    it('app admin can read any organizerRequest', async () => {
      await seedOrganizerRequest();
      const adminDb = await asAdmin(getEnv(), APP_ADMIN);
      await assertSucceeds(getDoc(doc(adminDb, `organizerRequests/${REQUEST_ID}`)));
    });

    it('an authenticated user cannot read someone else\'s organizerRequest', async () => {
      await seedOrganizerRequest();
      const bobDb = asUser(getEnv(), OTHER_USER);
      await assertFails(getDoc(doc(bobDb, `organizerRequests/${REQUEST_ID}`)));
    });

    it('anonymous user cannot read organizerRequests', async () => {
      await seedOrganizerRequest();
      const anon = asAnon(getEnv());
      await assertFails(getDoc(doc(anon, `organizerRequests/${REQUEST_ID}`)));
    });
  });

  describe('write (server-side only)', () => {
    it('the requester themselves cannot create an organizerRequest', async () => {
      const aliceDb = asUser(getEnv(), REQUESTER);
      await assertFails(
        setDoc(doc(aliceDb, `organizerRequests/${REQUEST_ID}`), {
          userId: REQUESTER,
          status: 'pending',
        }),
      );
    });

    it('an app admin cannot create an organizerRequest', async () => {
      const adminDb = await asAdmin(getEnv(), APP_ADMIN);
      await assertFails(
        setDoc(doc(adminDb, `organizerRequests/${REQUEST_ID}`), {
          userId: REQUESTER,
          status: 'pending',
        }),
      );
    });

    it('the requester cannot update their organizerRequest', async () => {
      await seedOrganizerRequest();
      const aliceDb = asUser(getEnv(), REQUESTER);
      await assertFails(
        updateDoc(doc(aliceDb, `organizerRequests/${REQUEST_ID}`), { status: 'approved' }),
      );
    });

    it('an app admin cannot update an organizerRequest', async () => {
      await seedOrganizerRequest();
      const adminDb = await asAdmin(getEnv(), APP_ADMIN);
      await assertFails(
        updateDoc(doc(adminDb, `organizerRequests/${REQUEST_ID}`), { status: 'approved' }),
      );
    });

    it('the requester cannot delete their organizerRequest', async () => {
      await seedOrganizerRequest();
      const aliceDb = asUser(getEnv(), REQUESTER);
      await assertFails(
        deleteDoc(doc(aliceDb, `organizerRequests/${REQUEST_ID}`)),
      );
    });

    it('an app admin cannot delete an organizerRequest', async () => {
      await seedOrganizerRequest();
      const adminDb = await asAdmin(getEnv(), APP_ADMIN);
      await assertFails(
        deleteDoc(doc(adminDb, `organizerRequests/${REQUEST_ID}`)),
      );
    });
  });
});
