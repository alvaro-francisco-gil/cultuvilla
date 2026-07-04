// Firestore Rules e2e test for /persons/{personId}.
// Verifies: owner can create their own persona; create is rejected when
// createdBy != auth.uid; owner can update photoURL; non-owner cannot update.
//
// Uses @firebase/rules-unit-testing to mount the live firestore.rules file
// against the firestore emulator and execute requests under different auth
// contexts.
import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, asAnon, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();

const OWNER = 'uid-1';
const OTHER = 'uid-2';
const PERSON_ID = 'p1';

const personData = (
  overrides: Partial<{ createdBy: string; userId: string | null }> = {},
) => ({
  givenName: 'Ana',
  middleNames: [],
  firstSurname: null,
  secondSurname: null,
  nickname: null,
  sex: null,
  birthday: null,
  deathDate: null,
  birthPlace: null,
  burialPlace: null,
  municipalityLinks: [],
  occupationIds: [],
  pendingOccupations: [],
  biography: null,
  photoURL: null,
  userId: overrides.userId ?? null,
  createdBy: overrides.createdBy ?? OWNER,
  createdAt: serverTimestamp(),
});

async function seedPerson(overrides: Partial<{ createdBy: string; userId: string | null }> = {}) {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `persons/${PERSON_ID}`), {
      ...personData(overrides),
      createdAt: new Date(),
    });
  });
}

describe('firestore.rules — /persons/{personId}', () => {
  describe('create', () => {
    it('owner can create their own persona', async () => {
      const ownerDb = asUser(getEnv(), OWNER);
      await assertSucceeds(
        setDoc(doc(ownerDb, `persons/${PERSON_ID}`), personData({ createdBy: OWNER })),
      );
    });

    it('create is rejected when createdBy != auth.uid', async () => {
      const ownerDb = asUser(getEnv(), OWNER);
      await assertFails(
        setDoc(doc(ownerDb, `persons/${PERSON_ID}`), personData({ createdBy: OTHER })),
      );
    });
  });

  describe('read', () => {
    it('an unauthenticated user can read a person', async () => {
      await seedPerson();
      const guestDb = asAnon(getEnv());
      await assertSucceeds(getDoc(doc(guestDb, `persons/${PERSON_ID}`)));
    });
  });

  describe('update', () => {
    it('owner can update photoURL after create', async () => {
      await seedPerson({ createdBy: OWNER, userId: OWNER });
      const ownerDb = asUser(getEnv(), OWNER);
      await assertSucceeds(
        updateDoc(doc(ownerDb, `persons/${PERSON_ID}`), { photoURL: 'https://example.com/photo.jpg' }),
      );
    });

    it('update is rejected for a different user', async () => {
      await seedPerson({ createdBy: OWNER, userId: OWNER });
      const otherDb = asUser(getEnv(), OTHER);
      await assertFails(
        updateDoc(doc(otherDb, `persons/${PERSON_ID}`), { photoURL: 'https://example.com/photo.jpg' }),
      );
    });
  });
});
