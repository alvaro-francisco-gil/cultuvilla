// The Wrapped lifecycle against the emulators: a block whose window closed is
// built and offered to the village admins, and a draft nobody answered
// publishes itself once its grace period runs out.

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import functionsTestFactory from 'firebase-functions-test';
import { resetEmulators } from '../../helpers/firestoreEmulator';
import { runVillageWrappedLifecycle } from '../../../wrapped/wrappedScheduler';
import { respondToVillageWrapped } from '../../../wrapped/respondToVillageWrapped';

const ft = functionsTestFactory({ projectId: process.env.GCLOUD_PROJECT || 'cultuvilla-test' });

const MID = 'mun-wrapped';
const ADMIN = 'ana';
const MEMBER = 'luis';
const BLOCK = 'agosto';
const WRAPPED_ID = `${MID}_2026_${BLOCK}`;
// The block closed yesterday, so the very next scheduler run picks it up.
const END = new Date(Date.now() - 24 * 60 * 60 * 1000);
const START = new Date(END.getTime() - 5 * 24 * 60 * 60 * 1000);

const db = () => admin.firestore();

async function seedVillage(fiestas: unknown[]): Promise<void> {
  await db().doc(`municipalities/${MID}`).set({
    name: 'Matabuena', nameLower: 'matabuena', nameAliases: [], localityNames: [], searchPrefixes: ['m'],
    slug: 'matabuena', province: 'Segovia', comunidadAutonoma: 'Castilla y León', codigoINE: '40118',
    coordinates: null, locationLabel: null, mapZoom: null, createdAt: new Date(),
    escudoUrl: null, escudoThumbUrl: null, escudoManualUrl: null,
    communityActive: true,
    community: { description: 'Un pueblo', organizerId: ADMIN, profileForm: null, activatedAt: new Date(), fiestas },
  });
  for (const [uid, role] of [[ADMIN, 'admin'], [MEMBER, 'user']] as const) {
    await db().doc(`municipalities/${MID}/members/${uid}`).set({
      userId: uid, role, joinedAt: new Date(), profileAnswers: {}, profileCompletedAt: null,
    });
  }
}

const exactBlock = [{
  id: BLOCK, name: 'Fiestas de agosto', anchor: { month: 8, day: 14, days: 15 },
  years: { 2026: { start: START, end: END } },
}];

async function seedEvents(count: number, confirmed: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    const id = `ev-${String(i)}`;
    await db().doc(`events/${id}`).set({
      municipalityId: MID, villageSlug: 'matabuena', title: `Evento ${String(i)}`, status: 'published',
      startDate: admin.firestore.Timestamp.fromDate(new Date(START.getTime() + 60_000)),
      commentCount: 0, createdBy: ADMIN, organizerOrgIds: [], imageURL: null,
      visibility: 'public', visibilityOrgId: null,
    });
    if (i < confirmed) {
      await db().doc(`events/${id}/registrations/r-${String(i)}`)
        .set({ personId: `p-${String(i)}`, userId: MEMBER, status: 'confirmed' });
    }
  }
}

/**
 * A scheduled function has no payload, so it is invoked through its own `run`
 * rather than `ft.wrap` — firebase-functions-test only wraps event handlers.
 */
async function runScheduler(): Promise<void> {
  await runVillageWrappedLifecycle.run({
    scheduleTime: new Date().toISOString(),
    jobName: 'test',
  } as Parameters<typeof runVillageWrappedLifecycle.run>[0]);
}

async function respond(uid: string | null, decision: string): Promise<unknown> {
  const wrapped = ft.wrap(respondToVillageWrapped);
  return wrapped({
    data: { wrappedId: WRAPPED_ID, decision },
    auth: uid ? { uid, token: {} } : undefined,
  } as unknown as Parameters<typeof wrapped>[0]);
}

describe('village Wrapped lifecycle', () => {
  beforeEach(async () => {
    await resetEmulators();
  });
  afterAll(() => {
    ft.cleanup();
  });

  it('builds a draft when a block ends, renders its cards, and tells the admins', async () => {
    await seedVillage(exactBlock);
    await seedEvents(4, 3);

    await runScheduler();

    const snap = await db().doc(`villageWrapped/${WRAPPED_ID}`).get();
    expect(snap.exists).toBe(true);
    const data = snap.data();
    expect(data?.status).toBe('draft');
    expect(data?.stats.eventCount).toBe(4);
    // Every card rendered and got a forwardable URL.
    expect(Object.keys(data?.images ?? {}).sort()).toEqual(
      ['cover', 'events', 'organizers', 'people', 'posters', 'stats'],
    );
    expect(data?.images.cover).toContain('token=');
    // A block that cleared the floor carries the timer that will release it.
    expect(data?.autoPublishAt).not.toBeNull();

    const adminInbox = await db().collection(`users/${ADMIN}/notifications`).get();
    expect(adminInbox.docs.map((d) => d.get('type'))).toEqual(['village_wrapped_ready']);
    const memberInbox = await db().collection(`users/${MEMBER}/notifications`).get();
    expect(memberInbox.empty).toBe(true);
  }, 180_000);

  it('leaves villages that never confirmed their dates alone', async () => {
    await seedVillage([{ id: BLOCK, name: 'Fiestas de agosto', anchor: { month: 8, day: 14, days: 15 }, years: {} }]);
    await seedEvents(4, 3);

    await runScheduler();

    expect((await db().collection('villageWrapped').get()).empty).toBe(true);
    expect((await db().collection(`users/${ADMIN}/notifications`).get()).empty).toBe(true);
  }, 120_000);

  // A thin Wrapped on the pueblo's own noticeboard reads as "nothing happened
  // here". It is still offered — an admin may decide it is worth showing.
  it('never puts a thin block on the auto-publish timer', async () => {
    await seedVillage(exactBlock);
    await seedEvents(1, 0);

    await runScheduler();

    const data = (await db().doc(`villageWrapped/${WRAPPED_ID}`).get()).data();
    expect(data?.status).toBe('draft');
    expect(data?.autoPublishAt).toBeNull();
    expect((await db().collection(`users/${ADMIN}/notifications`).get()).size).toBe(1);
  }, 120_000);

  it('publishes a draft whose grace period ran out', async () => {
    await seedVillage(exactBlock);
    await seedEvents(4, 3);
    await runScheduler();
    await db().doc(`villageWrapped/${WRAPPED_ID}`)
      .update({ autoPublishAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 1000)) });

    await runScheduler();

    const data = (await db().doc(`villageWrapped/${WRAPPED_ID}`).get()).data();
    expect(data?.status).toBe('published');
    expect(data?.autoPublishAt).toBeNull();
  }, 180_000);

  it('never rebuilds or re-notifies a Wrapped that already exists', async () => {
    await seedVillage(exactBlock);
    await seedEvents(4, 3);
    await runScheduler();
    const first = (await db().doc(`villageWrapped/${WRAPPED_ID}`).get()).get('computedAt');

    await runScheduler();

    const second = (await db().doc(`villageWrapped/${WRAPPED_ID}`).get()).get('computedAt');
    expect(second).toEqual(first);
    expect((await db().collection(`users/${ADMIN}/notifications`).get()).size).toBe(1);
  }, 240_000);

  it('leaves a discarded Wrapped alone forever', async () => {
    await seedVillage(exactBlock);
    await seedEvents(4, 3);
    await runScheduler();
    await respond(ADMIN, 'discard');

    await runScheduler();

    const data = (await db().doc(`villageWrapped/${WRAPPED_ID}`).get()).data();
    expect(data?.status).toBe('discarded');
    expect(data?.autoPublishAt).toBeNull();
  }, 240_000);

  describe('respondToVillageWrapped', () => {
    beforeEach(async () => {
      await seedVillage(exactBlock);
      await seedEvents(4, 3);
      await runScheduler();
    }, 180_000);

    it('lets a village admin publish', async () => {
      await expect(respond(ADMIN, 'publish')).resolves.toEqual({ status: 'published' });
      const data = (await db().doc(`villageWrapped/${WRAPPED_ID}`).get()).data();
      expect(data?.status).toBe('published');
      expect(data?.autoPublishAt).toBeNull();
    }, 120_000);

    it('refuses an ordinary member', async () => {
      await expect(respond(MEMBER, 'publish')).rejects.toThrow(/autorizado/);
    }, 120_000);

    it('refuses an anonymous caller', async () => {
      await expect(respond(null, 'publish')).rejects.toThrow(/sesión/);
    }, 120_000);

    it('refuses a second decision on the same Wrapped', async () => {
      await respond(ADMIN, 'publish');
      await expect(respond(ADMIN, 'discard')).rejects.toThrow(/resuelto/);
    }, 120_000);
  });
});
