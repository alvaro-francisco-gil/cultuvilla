// Handler test for the registerToEvent callable.
// Runs against the Firestore + Auth emulators via firebase-admin and uses
// firebase-functions-test to wrap the v2 callable.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import functionsTestFactory from 'firebase-functions-test';
import { resetEmulators } from '../helpers/firestoreEmulator';
import { registerToEvent } from '../../events/registerToEvent';

const ft = functionsTestFactory({ projectId: process.env.GCLOUD_PROJECT || 'cultuvilla-test' });

const MUNICIPALITY_ID = 'mun-1';
const EVENT_ID = 'e1';
const USER_ID = 'alice';
const OTHER_USER_ID = 'visitor';

async function seedEvent(opts: { maxAttendees: number | null }): Promise<void> {
  const now = new Date();
  await admin.firestore().doc(`events/${EVENT_ID}`).set({
    title: 'Fiesta',
    description: 'Una fiesta',
    startDate: now,
    location: { coordinates: { lat: 40.4, lng: -3.7 }, displayName: 'plaza' },
    imageURL: null,
    maxAttendees: opts.maxAttendees,
    telephoneRequired: false,
    status: 'published',
    organizerUserIds: ['creator-1'],
    organizerOrgIds: [],
    createdBy: 'creator-1',
    createdAt: now,
    updatedAt: now,
    municipalityId: MUNICIPALITY_ID,
    villageName: 'Villarriba',
    villageCoverImage: null,
    villageCoordinates: null,
    confirmedCount: 0,
    totalCount: 0,
    endBoundary: now,
  });
}

async function seedMembership(userId: string): Promise<void> {
  await admin.firestore().doc(`municipalities/${MUNICIPALITY_ID}/members/${userId}`).set({
    userId,
    role: 'user',
    joinedAt: new Date(),
    profileAnswers: {},
    profileCompletedAt: null,
    trustedNewsAuthor: false,
    barrioId: null,
  });
}

async function seedExistingReg(
  id: string,
  opts: { userId: string; status: 'confirmed' | 'waitlisted'; position: number },
): Promise<void> {
  await admin.firestore().doc(`events/${EVENT_ID}/registrations/${id}`).set({
    userId: opts.userId,
    personId: `${opts.userId}-self`,
    name: opts.userId,
    status: opts.status,
    position: opts.position,
    isMember: false,
    checkedInAt: null,
    registeredAt: new Date(),
  });
}

interface CallableResult {
  registrations: Array<{
    id: string;
    status: 'confirmed' | 'waitlisted';
    position: number;
    isMember: boolean;
  }>;
}

async function callRegister(opts: {
  uid: string | null;
  data: unknown;
}): Promise<CallableResult> {
  const wrapped = ft.wrap(registerToEvent as unknown as Parameters<typeof ft.wrap>[0]);
  return (await wrapped({
    data: opts.data,
    auth: opts.uid ? { uid: opts.uid, token: {} } : undefined,
  } as unknown as Parameters<typeof wrapped>[0])) as unknown as CallableResult;
}

describe('registerToEvent (callable)', () => {
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
    await seedEvent({ maxAttendees: 10 });
    await expect(
      callRegister({
        uid: null,
        data: { eventId: EVENT_ID, registrants: [{ personId: 'p1', name: 'Ana' }] },
      }),
    ).rejects.toThrow(/unauthenticated|inici/i);
  });

  it('throws invalid-argument when registrants is empty', async () => {
    await seedEvent({ maxAttendees: 10 });
    await expect(
      callRegister({ uid: USER_ID, data: { eventId: EVENT_ID, registrants: [] } }),
    ).rejects.toThrow(/asistente/);
  });

  it('throws not-found when the event does not exist', async () => {
    await expect(
      callRegister({
        uid: USER_ID,
        data: { eventId: 'missing', registrants: [{ personId: 'p1', name: 'Ana' }] },
      }),
    ).rejects.toThrow(/no existe|not.?found/i);
  });

  it('confirms all registrants when the event has no maxAttendees', async () => {
    await seedEvent({ maxAttendees: null });
    const result = await callRegister({
      uid: USER_ID,
      data: {
        eventId: EVENT_ID,
        registrants: [
          { personId: 'p1', name: 'Ana' },
          { personId: 'p2', name: 'Bea' },
        ],
      },
    });
    expect(result.registrations.map((r) => r.status)).toEqual(['confirmed', 'confirmed']);
    const docs = await admin
      .firestore()
      .collection(`events/${EVENT_ID}/registrations`)
      .get();
    expect(docs.size).toBe(2);
  });

  it('confirms up to capacity and waitlists the rest in one call', async () => {
    await seedEvent({ maxAttendees: 2 });
    const result = await callRegister({
      uid: USER_ID,
      data: {
        eventId: EVENT_ID,
        registrants: [
          { personId: 'p1', name: 'Ana' },
          { personId: 'p2', name: 'Bea' },
          { personId: 'p3', name: 'Carmen' },
        ],
      },
    });
    expect(result.registrations.map((r) => r.status)).toEqual([
      'confirmed',
      'confirmed',
      'waitlisted',
    ]);
  });

  it('waitlists new registrants when capacity is already taken', async () => {
    await seedEvent({ maxAttendees: 1 });
    await seedExistingReg('r0', { userId: OTHER_USER_ID, status: 'confirmed', position: 1 });
    const result = await callRegister({
      uid: USER_ID,
      data: { eventId: EVENT_ID, registrants: [{ personId: 'p1', name: 'Ana' }] },
    });
    expect(result.registrations[0].status).toBe('waitlisted');
    expect(result.registrations[0].position).toBe(2);
  });

  it('sets isMember=true when the caller is a village member', async () => {
    await seedEvent({ maxAttendees: 10 });
    await seedMembership(USER_ID);
    const result = await callRegister({
      uid: USER_ID,
      data: { eventId: EVENT_ID, registrants: [{ personId: 'p1', name: 'Ana' }] },
    });
    expect(result.registrations[0].isMember).toBe(true);
    const reg = await admin
      .firestore()
      .doc(`events/${EVENT_ID}/registrations/${result.registrations[0].id}`)
      .get();
    expect(reg.data()?.isMember).toBe(true);
  });

  it('sets isMember=false when the caller is not a village member', async () => {
    await seedEvent({ maxAttendees: 10 });
    const result = await callRegister({
      uid: USER_ID,
      data: { eventId: EVENT_ID, registrants: [{ personId: 'p1', name: 'Ana' }] },
    });
    expect(result.registrations[0].isMember).toBe(false);
  });

  it('persists userId, personId, name, status, position, registeredAt, isMember on each reg', async () => {
    await seedEvent({ maxAttendees: 10 });
    const result = await callRegister({
      uid: USER_ID,
      data: { eventId: EVENT_ID, registrants: [{ personId: 'p1', name: 'Ana' }] },
    });
    const reg = await admin
      .firestore()
      .doc(`events/${EVENT_ID}/registrations/${result.registrations[0].id}`)
      .get();
    const data = reg.data();
    expect(data?.userId).toBe(USER_ID);
    expect(data?.personId).toBe('p1');
    expect(data?.name).toBe('Ana');
    expect(data?.status).toBe('confirmed');
    expect(data?.position).toBe(1);
    expect(data?.isMember).toBe(false);
    expect(data?.registeredAt).toBeDefined();
  });

  it('writes confirmedCount and totalCount on the event doc', async () => {
    await seedEvent({ maxAttendees: 2 });
    await callRegister({
      uid: USER_ID,
      data: {
        eventId: EVENT_ID,
        registrants: [
          { personId: 'p1', name: 'Ana' },
          { personId: 'p2', name: 'Bea' },
          { personId: 'p3', name: 'Carmen' },
        ],
      },
    });
    const eventDoc = await admin.firestore().doc(`events/${EVENT_ID}`).get();
    expect(eventDoc.data()?.confirmedCount).toBe(2);
    expect(eventDoc.data()?.totalCount).toBe(3);
  });

  it('increments existing confirmedCount and totalCount when seeded regs exist', async () => {
    await seedEvent({ maxAttendees: 5 });
    await seedExistingReg('r0', { userId: OTHER_USER_ID, status: 'confirmed', position: 1 });
    await callRegister({
      uid: USER_ID,
      data: { eventId: EVENT_ID, registrants: [{ personId: 'p1', name: 'Ana' }] },
    });
    const eventDoc = await admin.firestore().doc(`events/${EVENT_ID}`).get();
    expect(eventDoc.data()?.confirmedCount).toBe(2);
    expect(eventDoc.data()?.totalCount).toBe(2);
  });
});
