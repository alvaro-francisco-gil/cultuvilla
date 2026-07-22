import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as admin from 'firebase-admin';
import functionsTestFactory from 'firebase-functions-test';
import { resetEmulators } from '../../helpers/firestoreEmulator';
import { syncMunicipalityPeople } from '../../../village/syncMunicipalityPeople';

const ft = functionsTestFactory({ projectId: process.env.GCLOUD_PROJECT || 'cultuvilla-test' });
const wrapped = ft.wrap(syncMunicipalityPeople);

interface Link { municipalityId: string; barrioId: string | null }
interface Person { givenName: string; middleNames: string[]; firstSurname: string | null; secondSurname: string | null; municipalityLinks: Link[]; photoURL: string | null; userId: string | null }

function person(overrides: Partial<Person> = {}): Person {
  return { givenName: 'Álvaro', middleNames: [], firstSurname: 'García', secondSurname: null, municipalityLinks: [], photoURL: null, userId: null, ...overrides };
}

async function fire(before: Person | null, after: Person | null, personId = 'p1'): Promise<void> {
  const beforeSnap = ft.firestore.makeDocumentSnapshot(before ?? {}, `persons/${personId}`);
  const afterSnap = ft.firestore.makeDocumentSnapshot(after ?? {}, `persons/${personId}`);
  await wrapped({ data: ft.makeChange(beforeSnap, afterSnap), params: { personId } } as unknown as Parameters<typeof wrapped>[0]);
}

beforeAll(async () => { await resetEmulators(); });
beforeEach(async () => { await resetEmulators(); });
afterAll(() => { ft.cleanup(); });

describe('syncMunicipalityPeople', () => {
  it('creates an alphabetically sortable row for a dependent persona', async () => {
    await fire(null, person({ municipalityLinks: [{ municipalityId: 'm1', barrioId: null }] }));
    const row = await admin.firestore().doc('municipalityPeople/m1_p1').get();
    expect(row.data()).toMatchObject({ municipalityId: 'm1', personId: 'p1', displayName: 'Álvaro García', sortName: 'alvaro garcia', userId: null });
  });

  it('adds and removes rows when municipality links change', async () => {
    await fire(
      person({ municipalityLinks: [{ municipalityId: 'm1', barrioId: null }] }),
      person({ municipalityLinks: [{ municipalityId: 'm2', barrioId: 'b2' }], userId: 'u1' }),
    );
    expect((await admin.firestore().doc('municipalityPeople/m1_p1').get()).exists).toBe(false);
    expect((await admin.firestore().doc('municipalityPeople/m2_p1').get()).get('userId')).toBe('u1');
  });

  it('removes all directory rows when the person is deleted', async () => {
    await admin.firestore().doc('municipalityPeople/m1_p1').set({ municipalityId: 'm1' });
    await fire(person({ municipalityLinks: [{ municipalityId: 'm1', barrioId: null }] }), null);
    expect((await admin.firestore().doc('municipalityPeople/m1_p1').get()).exists).toBe(false);
  });
});
