// Handler test for the callable that serves the founders' panel. The access
// check is the ONLY thing protecting this data: an earlier version of the panel
// lived inside the mobile app, where the route guard hid the screen but the JSON
// still shipped in the public web bundle. So these tests are about who is
// refused, not about what the snapshot contains.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import { resetEmulators } from '../helpers/firestoreEmulator';
import { runGetBusinessSnapshot } from '../../business/getBusinessSnapshot';
import { BusinessSnapshotSchema } from '@cultuvilla/shared/models';

const ADMIN_UID = 'founder-1';
const OUTSIDER_UID = 'someone-else';

describe('runGetBusinessSnapshot', () => {
  beforeAll(() => {
    if (admin.apps.length === 0) admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'cultuvilla-test' });
  });

  beforeEach(async () => {
    await resetEmulators();
    await admin.firestore().collection('admins').doc(ADMIN_UID).set({ createdAt: new Date() });
  });

  afterAll(async () => {
    await resetEmulators();
  });

  it('refuses a signed-out caller', async () => {
    await expect(runGetBusinessSnapshot(null)).rejects.toThrow(/sesión/i);
  });

  it('refuses a signed-in caller who is not an app admin', async () => {
    await expect(runGetBusinessSnapshot(OUTSIDER_UID)).rejects.toThrow(/equipo/i);
  });

  it('returns the snapshot to an app admin', async () => {
    const snapshot = await runGetBusinessSnapshot(ADMIN_UID);
    expect(BusinessSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('stops returning it the moment the admin doc is removed', async () => {
    await expect(runGetBusinessSnapshot(ADMIN_UID)).resolves.toBeDefined();
    await admin.firestore().collection('admins').doc(ADMIN_UID).delete();
    await expect(runGetBusinessSnapshot(ADMIN_UID)).rejects.toThrow(/equipo/i);
  });

  it('serves a snapshot that carries every kind the panel renders', async () => {
    const snapshot = BusinessSnapshotSchema.parse(await runGetBusinessSnapshot(ADMIN_UID));
    for (const kind of ['convocatoria', 'evento', 'entidad', 'propuesta'] as const) {
      expect(snapshot.counts[kind]).toBe(snapshot.byKind[kind].length);
    }
  });
});
