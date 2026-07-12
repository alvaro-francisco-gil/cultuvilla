// Handler test for the acceptInvite callable — focused on the residence-link
// projection it took over from the (now delete-only) syncMemberBarrioToResidence
// trigger. On accepting an invite a new member must appear in getPersonsByBarrio,
// i.e. gain a whole-village { municipalityId, barrioId: null } link on their
// person doc: a NEW user gets it via buildPersonData; an EXISTING user gets it
// upserted into their existing person doc.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import functionsTestFactory from 'firebase-functions-test';
import { buildUserData, buildPersonData } from '@cultuvilla/shared/models';
import { resetEmulators } from '../helpers/firestoreEmulator';
import { acceptInvite } from '../../village/acceptInvite';

const ft = functionsTestFactory({ projectId: process.env.GCLOUD_PROJECT || 'cultuvilla-test' });

const MUNI = 'mun-1';
const OTHER_MUNI = 'mun-2';
const TOKEN = 'tok-1';
const NEW_USER = 'newbie';
const EXISTING_USER = 'veteran';
const EXISTING_PERSON = 'person-veteran';

async function seedMunicipality(): Promise<void> {
  // Only `.exists` is checked on the municipality, so a minimal doc suffices.
  await admin.firestore().doc(`municipalities/${MUNI}`).set({ name: 'Villarriba' });
}

async function seedToken(): Promise<void> {
  await admin.firestore().doc(`municipalities/${MUNI}/inviteTokens/${TOKEN}`).set({
    createdAt: new Date(),
    expiresAt: null,
    usageCount: 0,
  });
}

interface AcceptResult {
  municipalityId: string;
  alreadyMember: boolean;
  profileCreated: boolean;
}

async function callAccept(opts: { uid: string; data: unknown }): Promise<AcceptResult> {
  const wrapped = ft.wrap(acceptInvite as unknown as Parameters<typeof ft.wrap>[0]);
  return (await wrapped({
    data: opts.data,
    auth: { uid: opts.uid, token: {} },
  } as unknown as Parameters<typeof wrapped>[0])) as unknown as AcceptResult;
}

beforeAll(async () => {
  await resetEmulators();
});

beforeEach(async () => {
  await resetEmulators();
  await seedMunicipality();
  await seedToken();
});

afterAll(() => {
  ft.cleanup();
});

describe('acceptInvite — residence link projection', () => {
  it('gives a NEW user a whole-village residence link on their created person', async () => {
    const result = await callAccept({
      uid: NEW_USER,
      data: {
        municipalityId: MUNI,
        tokenId: TOKEN,
        profile: {
          displayName: 'Nuevo Vecino',
          email: 'nuevo@example.com',
          birthday: '1990-05-01',
        },
      },
    });
    expect(result.profileCreated).toBe(true);
    expect(result.alreadyMember).toBe(false);

    const persons = await admin
      .firestore()
      .collection('persons')
      .where('userId', '==', NEW_USER)
      .get();
    expect(persons.size).toBe(1);
    expect(persons.docs[0].get('municipalityLinks')).toEqual([
      { municipalityId: MUNI, barrioId: null },
    ]);
  });

  it('upserts a residence link into an EXISTING user person, preserving other villages', async () => {
    await admin
      .firestore()
      .doc(`users/${EXISTING_USER}`)
      .set(
        buildUserData({
          displayName: 'Vieja Vecina',
          email: 'vieja@example.com',
          personId: EXISTING_PERSON,
        }),
      );
    await admin
      .firestore()
      .doc(`persons/${EXISTING_PERSON}`)
      .set(
        buildPersonData({
          givenName: 'Vieja',
          userId: EXISTING_USER,
          createdBy: EXISTING_USER,
          municipalityLinks: [{ municipalityId: OTHER_MUNI, barrioId: 'centro' }],
        }),
      );

    const result = await callAccept({
      uid: EXISTING_USER,
      data: { municipalityId: MUNI, tokenId: TOKEN },
    });
    expect(result.profileCreated).toBe(false);
    expect(result.alreadyMember).toBe(false);

    const links = (await admin.firestore().doc(`persons/${EXISTING_PERSON}`).get()).get(
      'municipalityLinks',
    ) as { municipalityId: string; barrioId: string | null }[];
    expect(links).toContainEqual({ municipalityId: OTHER_MUNI, barrioId: 'centro' });
    expect(links).toContainEqual({ municipalityId: MUNI, barrioId: null });
    expect(links).toHaveLength(2);
  });

  it('does not add a duplicate link when re-accepting as an already-member', async () => {
    // Seed an existing member + person already linked to this village.
    await admin
      .firestore()
      .doc(`users/${EXISTING_USER}`)
      .set(
        buildUserData({
          displayName: 'Vieja Vecina',
          email: 'vieja@example.com',
          personId: EXISTING_PERSON,
        }),
      );
    await admin
      .firestore()
      .doc(`persons/${EXISTING_PERSON}`)
      .set(
        buildPersonData({
          givenName: 'Vieja',
          userId: EXISTING_USER,
          createdBy: EXISTING_USER,
          municipalityLinks: [{ municipalityId: MUNI, barrioId: null }],
        }),
      );
    await admin
      .firestore()
      .doc(`municipalities/${MUNI}/members/${EXISTING_USER}`)
      .set({ userId: EXISTING_USER, role: 'user' });

    const result = await callAccept({
      uid: EXISTING_USER,
      data: { municipalityId: MUNI, tokenId: TOKEN },
    });
    expect(result.alreadyMember).toBe(true);

    const links = (await admin.firestore().doc(`persons/${EXISTING_PERSON}`).get()).get(
      'municipalityLinks',
    ) as unknown[];
    expect(links).toEqual([{ municipalityId: MUNI, barrioId: null }]);
  });
});
