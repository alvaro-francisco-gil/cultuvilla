/* eslint-disable @typescript-eslint/no-unsafe-argument,
                  @typescript-eslint/no-explicit-any,
                  @typescript-eslint/require-await */
// vi.mock factories legitimately fake the firebase/firestore SDK shape.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getDb: vi.fn() }));
vi.mock('firebase/firestore', async () => {
  const makeRef = (..._args: unknown[]) => {
    const ref: { _path: unknown[]; withConverter: ReturnType<typeof vi.fn> } = {
      _path: _args,
      withConverter: vi.fn(),
    };
    ref.withConverter.mockReturnValue(ref);
    return ref;
  };
  return {
    collection: vi.fn((..._args) => makeRef(..._args)),
    doc: vi.fn((..._args) => makeRef(..._args)),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    setDoc: vi.fn(),
    deleteDoc: vi.fn(),
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    writeBatch: vi.fn(),
    getCountFromServer: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  };
});

import { deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import {
  getNotificationPrefs,
  registerDevice,
  saveNotificationPrefs,
  unregisterDevice,
} from '../../src/services/notificationService';
import { DEFAULT_NOTIFICATION_PREFS } from '../../src/models/notification';

const pathOf = (ref: unknown) => (ref as { _path: unknown[] })._path.slice(1);

describe('push devices', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers a device at a doc keyed by its own token', async () => {
    await registerDevice('u1', { token: 'tok', platform: 'android', appVersion: '1.2.0' });
    const [ref, payload] = vi.mocked(setDoc).mock.calls[0];
    expect(pathOf(ref)).toEqual(['users', 'u1', 'devices', 'tok']);
    expect(payload).toMatchObject({ token: 'tok', platform: 'android', apnsEnvironment: null, apnsTopic: null });
  });

  it('unregisters only the one device', async () => {
    await unregisterDevice('u1', 'tok');
    expect(pathOf(vi.mocked(deleteDoc).mock.calls[0][0])).toEqual(['users', 'u1', 'devices', 'tok']);
  });
});

describe('push preferences', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the defaults for an account that never saved any', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);
    expect(await getNotificationPrefs('u1')).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('returns the stored preferences when they exist', async () => {
    const stored = { ...DEFAULT_NOTIFICATION_PREFS, village: false };
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => stored } as any);
    expect(await getNotificationPrefs('u1')).toEqual(stored);
  });

  it('saves the full preferences doc at its fixed path', async () => {
    await saveNotificationPrefs('u1', { village: false });
    const [ref, payload] = vi.mocked(setDoc).mock.calls[0];
    expect(pathOf(ref)).toEqual(['users', 'u1', 'preferences', 'notifications']);
    expect(payload).toMatchObject({ mine: true, village: false, social: true, quietHours: true });
  });
});
