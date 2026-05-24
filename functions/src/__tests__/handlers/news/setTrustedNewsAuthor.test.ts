// Handler test for the setTrustedNewsAuthor callable.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import functionsTestFactory from 'firebase-functions-test';
import { resetEmulators } from '../../helpers/firestoreEmulator';
import { setTrustedNewsAuthor } from '../../../news/setTrustedNewsAuthor';

const ft = functionsTestFactory({ projectId: process.env.GCLOUD_PROJECT || 'cultuvilla-test' });

const MUNICIPALITY_ID = 'mun-1';
const ADMIN_UID = 'vadmin';
const TARGET_UID = 'target-user';
const OUTSIDER_UID = 'eve';

async function seedMember(uid: string, role: 'admin' | 'user', trusted = false): Promise<void> {
  await admin
    .firestore()
    .doc(`municipalities/${MUNICIPALITY_ID}/members/${uid}`)
    .set({
      uid,
      role,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      trustedNewsAuthor: trusted,
    });
}

interface CallableResult {
  ok: true;
}

async function callSetTrusted(opts: { uid: string | null; data: unknown }): Promise<CallableResult> {
  const wrapped = ft.wrap(setTrustedNewsAuthor as unknown as Parameters<typeof ft.wrap>[0]);
  return (await wrapped({
    data: opts.data,
    auth: opts.uid ? { uid: opts.uid, token: {} } : undefined,
  } as unknown as Parameters<typeof wrapped>[0])) as unknown as CallableResult;
}

describe('setTrustedNewsAuthor (callable)', () => {
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
      callSetTrusted({ uid: null, data: { municipalityId: MUNICIPALITY_ID, userId: TARGET_UID, trusted: true } }),
    ).rejects.toThrow(/unauthenticated|inici/i);
  });

  it('throws permission-denied for non-admin caller', async () => {
    await seedMember(TARGET_UID, 'user');
    await expect(
      callSetTrusted({
        uid: OUTSIDER_UID,
        data: { municipalityId: MUNICIPALITY_ID, userId: TARGET_UID, trusted: true },
      }),
    ).rejects.toThrow(/autorizado|permission-denied/i);
  });

  it('admin sets trustedNewsAuthor=true on an existing member', async () => {
    await seedMember(ADMIN_UID, 'admin');
    await seedMember(TARGET_UID, 'user', false);

    const result = await callSetTrusted({
      uid: ADMIN_UID,
      data: { municipalityId: MUNICIPALITY_ID, userId: TARGET_UID, trusted: true },
    });
    expect(result.ok).toBe(true);

    const snap = await admin
      .firestore()
      .doc(`municipalities/${MUNICIPALITY_ID}/members/${TARGET_UID}`)
      .get();
    expect(snap.data()?.trustedNewsAuthor).toBe(true);
  });

  it('admin sets trustedNewsAuthor back to false', async () => {
    await seedMember(ADMIN_UID, 'admin');
    await seedMember(TARGET_UID, 'user', true);

    await callSetTrusted({
      uid: ADMIN_UID,
      data: { municipalityId: MUNICIPALITY_ID, userId: TARGET_UID, trusted: false },
    });

    const snap = await admin
      .firestore()
      .doc(`municipalities/${MUNICIPALITY_ID}/members/${TARGET_UID}`)
      .get();
    expect(snap.data()?.trustedNewsAuthor).toBe(false);
  });

  it('throws not-found when target is not a member', async () => {
    await seedMember(ADMIN_UID, 'admin');
    await expect(
      callSetTrusted({
        uid: ADMIN_UID,
        data: { municipalityId: MUNICIPALITY_ID, userId: 'nonexistent', trusted: true },
      }),
    ).rejects.toThrow(/miembro|not.?found/i);
  });
});
