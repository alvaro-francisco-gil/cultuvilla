// The day-before reminder for events you hold a seat at.
import { describe, it, expect, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';
import { resetEmulators } from '../helpers/firestoreEmulator';
import { sendEventReminders } from '../../events/eventReminders';

const run = () => sendEventReminders.run({ scheduleTime: new Date().toISOString() });
const db = () => admin.firestore();
const HOUR = 60 * 60 * 1000;

async function seedEvent(id: string, startsInHours: number, status: 'published' | 'cancelled' = 'published') {
  const now = new Date();
  const startDate = new Date(now.getTime() + startsInHours * HOUR);
  await db().doc(`events/${id}`).set({
    title: `Evento ${id}`,
    description: '',
    startDate,
    endDate: null,
    location: { coordinates: new admin.firestore.GeoPoint(40.4, -3.7), displayName: 'plaza' },
    imageURL: null,
    maxAttendees: null,
    telephoneRequired: false,
    requiresPayment: false,
    signupFields: [],
    status,
    organizerUserIds: ['organizer'],
    organizerOrgIds: [],
    createdBy: 'organizer',
    createdAt: now,
    updatedAt: now,
    municipalityId: 'mun',
    villageName: 'Matabuena',
    villageCoverImage: null,
    villageCoordinates: null,
    confirmedCount: 0,
    totalCount: 0,
    endBoundary: startDate,
    commentCount: 0,
    readCount: 0,
  });
}

// The reminder reads only `userId` + `status` (a projection), so the fixture
// carries only those.
async function seedRegistration(eventId: string, regId: string, userId: string, status: 'confirmed' | 'waitlisted') {
  await db().doc(`events/${eventId}/registrations/${regId}`).set({ userId, status });
}

async function notificationsOf(uid: string) {
  return (await db().collection(`users/${uid}/notifications`).get()).docs;
}

beforeEach(async () => {
  await resetEmulators();
});

describe('sendEventReminders', () => {
  it('reminds confirmed attendees of an event ~24h out, once per person', async () => {
    await seedEvent('soon', 23.5);
    await seedRegistration('soon', 'r1', 'u1', 'confirmed');
    await seedRegistration('soon', 'r2', 'u1', 'confirmed'); // a family member, same account
    await seedRegistration('soon', 'r3', 'u2', 'waitlisted');

    await run();

    const [n, ...rest] = await notificationsOf('u1');
    expect(rest).toHaveLength(0);
    expect(n.id).toBe('event_reminder_soon');
    expect(n.data()).toMatchObject({ type: 'event_reminder', eventId: 'soon', municipalityId: 'mun' });
    // No seat, nothing to be reminded of.
    expect(await notificationsOf('u2')).toHaveLength(0);
  });

  it('ignores events outside the one-hour window and cancelled ones', async () => {
    await seedEvent('later', 30);
    await seedEvent('cancelled', 23.5, 'cancelled');
    await seedRegistration('later', 'r1', 'u1', 'confirmed');
    await seedRegistration('cancelled', 'r2', 'u1', 'confirmed');

    await run();
    expect(await notificationsOf('u1')).toHaveLength(0);
  });

  it('is idempotent across overlapping runs', async () => {
    await seedEvent('soon', 23.5);
    await seedRegistration('soon', 'r1', 'u1', 'confirmed');
    await run();
    await run();
    expect(await notificationsOf('u1')).toHaveLength(1);
  });
});
