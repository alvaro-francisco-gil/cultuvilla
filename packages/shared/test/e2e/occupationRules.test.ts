// Firestore Rules e2e test for /occupations/{slug}.
//
// occupations/ is a collected free-text tally (Task 11 — see
// docs/plans/ready/content-moderation-unification.md): any authenticated
// client may upsert via recordOccupation(); it is public-read and no longer
// moderated (the old occupationProposals/ propose-then-review flow is gone).
//
// Uses @firebase/rules-unit-testing to mount the live firestore.rules file
// against the firestore emulator and execute requests under different auth
// contexts.
import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, asAnon, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();

// Mirrors the merge payload written by recordOccupation() in
// packages/shared/src/services/occupationService.ts.
const recordOccupationPayload = () => ({
  name: 'Panadería',
  count: increment(1),
  updatedAt: serverTimestamp(),
});

describe('firestore.rules — /occupations/{slug}', () => {
  it('allows an unauthenticated client to read', async () => {
    await seed(getEnv(), async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'occupations/panaderia'), {
        name: 'Panadería',
        count: 1,
        updatedAt: new Date(),
      });
    });
    const anonDb = asAnon(getEnv());
    await assertSucceeds(getDoc(doc(anonDb, 'occupations/panaderia')));
  });

  it('allows an authenticated client to upsert', async () => {
    const userDb = asUser(getEnv(), 'uid-1');
    await assertSucceeds(
      setDoc(doc(userDb, 'occupations/panaderia'), recordOccupationPayload(), { merge: true }),
    );
  });

  it('denies an unauthenticated client from writing', async () => {
    const anonDb = asAnon(getEnv());
    await assertFails(
      setDoc(doc(anonDb, 'occupations/panaderia'), recordOccupationPayload(), { merge: true }),
    );
  });

  it('has no occupationProposals rules left — create is denied outright', async () => {
    const userDb = asUser(getEnv(), 'uid-1');
    await assertFails(
      setDoc(doc(userDb, 'occupationProposals/prop1'), {
        name: 'Panadería',
        proposedBy: 'uid-1',
        proposedAt: serverTimestamp(),
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        approvedOccupationId: null,
      }),
    );
  });
});
