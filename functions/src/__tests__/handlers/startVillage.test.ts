// Handler test for the startVillage callable.
// A villager activates a dormant municipality's community WITHOUT becoming its
// organizer: the community is created with adminUserId === null, and the caller
// is added as a plain member.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import functionsTestFactory from 'firebase-functions-test';
import { resetEmulators } from '../helpers/firestoreEmulator';
import { startVillage } from '../../village/startVillage';

const ft = functionsTestFactory({ projectId: process.env.GCLOUD_PROJECT || 'cultuvilla-test' });

const MUNICIPALITY_ID = 'mun-1';
const STARTER_ID = 'alice';

async function seedMunicipality(communityActive: boolean): Promise<void> {
  const now = new Date();
  await admin
    .firestore()
    .doc(`municipalities/${MUNICIPALITY_ID}`)
    .set({
      name: 'Villarriba',
      nameLower: 'villarriba',
      province: 'Madrid',
      comunidadAutonoma: 'Madrid',
      codigoINE: '28000',
      coordinates: null,
      mapZoom: null,
      createdAt: now,
      escudoUrl: null,
      escudoThumbUrl: null,
      escudoManualUrl: null,
      communityActive,
      community: communityActive
        ? { description: 'ya', adminUserId: 'someone', profileForm: null, activatedAt: now }
        : null,
    });
}

interface CallableResult {
  ok: true;
}

async function callStart(opts: { uid: string | null; data: unknown }): Promise<CallableResult> {
  const wrapped = ft.wrap(startVillage as unknown as Parameters<typeof ft.wrap>[0]);
  return (await wrapped({
    data: opts.data,
    auth: opts.uid ? { uid: opts.uid, token: {} } : undefined,
  } as unknown as Parameters<typeof wrapped>[0])) as unknown as CallableResult;
}

describe('startVillage (callable)', () => {
  beforeAll(async () => {
    await resetEmulators();
  });

  beforeEach(async () => {
    await resetEmulators();
  });

  afterAll(() => {
    ft.cleanup();
  });

  it('throws unauthenticated when no auth context', async () => {
    await expect(
      callStart({ uid: null, data: { municipalityId: MUNICIPALITY_ID } }),
    ).rejects.toThrow(/unauthenticated|inici/i);
  });

  it('throws invalid-argument when municipalityId is missing', async () => {
    await expect(callStart({ uid: STARTER_ID, data: {} })).rejects.toThrow(
      /municipalityId|invalid-argument/i,
    );
  });

  it('throws not-found when the municipality does not exist', async () => {
    await expect(
      callStart({ uid: STARTER_ID, data: { municipalityId: 'missing' } }),
    ).rejects.toThrow(/no encontrado|not.?found/i);
  });

  it('throws failed-precondition when the community is already active', async () => {
    await seedMunicipality(true);
    await expect(
      callStart({ uid: STARTER_ID, data: { municipalityId: MUNICIPALITY_ID } }),
    ).rejects.toThrow(/ya está activa|failed-precondition/i);
  });

  it('activates the community with a null organizer and adds the starter as a member', async () => {
    await seedMunicipality(false);

    const result = await callStart({
      uid: STARTER_ID,
      data: {
        municipalityId: MUNICIPALITY_ID,
        description: '  Mi pueblo  ',
      },
    });
    expect(result.ok).toBe(true);

    const muniDoc = await admin.firestore().doc(`municipalities/${MUNICIPALITY_ID}`).get();
    expect(muniDoc.data()?.communityActive).toBe(true);
    expect(muniDoc.data()?.community?.adminUserId).toBeNull();
    expect(muniDoc.data()?.community?.description).toBe('Mi pueblo');

    const memberDoc = await admin
      .firestore()
      .doc(`municipalities/${MUNICIPALITY_ID}/members/${STARTER_ID}`)
      .get();
    expect(memberDoc.exists).toBe(true);
    expect(memberDoc.data()?.role).toBe('user');
  });

  it('stores the uploaded escudoManualUrl when the village has none', async () => {
    await seedMunicipality(false);

    await callStart({
      uid: STARTER_ID,
      data: {
        municipalityId: MUNICIPALITY_ID,
        escudoManualUrl: '  https://example.com/escudo.webp  ',
      },
    });

    const muniDoc = await admin.firestore().doc(`municipalities/${MUNICIPALITY_ID}`).get();
    expect(muniDoc.data()?.escudoManualUrl).toBe('https://example.com/escudo.webp');
  });

  it('stores the location set during activation', async () => {
    await seedMunicipality(false);

    await callStart({
      uid: STARTER_ID,
      data: {
        municipalityId: MUNICIPALITY_ID,
        coordinates: { lat: 40.4, lng: -3.7 },
        mapZoom: 14,
      },
    });

    const muniDoc = await admin.firestore().doc(`municipalities/${MUNICIPALITY_ID}`).get();
    expect(muniDoc.data()?.coordinates).toEqual({ lat: 40.4, lng: -3.7 });
    expect(muniDoc.data()?.mapZoom).toBe(14);
  });

  it('ignores escudoManualUrl when the village already has a manual escudo', async () => {
    const now = new Date();
    await admin
      .firestore()
      .doc(`municipalities/${MUNICIPALITY_ID}`)
      .set({
        name: 'Villarriba',
        nameLower: 'villarriba',
        province: 'Madrid',
        comunidadAutonoma: 'Madrid',
        codigoINE: '28000',
        coordinates: null,
        mapZoom: null,
        createdAt: now,
        escudoUrl: null,
        escudoThumbUrl: null,
        escudoManualUrl: 'https://example.com/existing.webp',
        communityActive: false,
        community: null,
      });

    await callStart({
      uid: STARTER_ID,
      data: {
        municipalityId: MUNICIPALITY_ID,
        escudoManualUrl: 'https://example.com/new.webp',
      },
    });

    const muniDoc = await admin.firestore().doc(`municipalities/${MUNICIPALITY_ID}`).get();
    expect(muniDoc.data()?.escudoManualUrl).toBe('https://example.com/existing.webp');
  });
});
