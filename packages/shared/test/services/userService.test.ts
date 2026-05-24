import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getDb: vi.fn() }));
vi.mock('firebase/firestore', async () => {
  return {
    collection: vi.fn(),
    doc: vi.fn((..._args) => ({ _path: _args })),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    serverTimestamp: () => '__SERVER_TIMESTAMP__',
    Timestamp: { fromDate: (d: Date) => ({ toDate: () => d, _d: d }) },
    query: vi.fn(),
    orderBy: vi.fn(),
  };
});

import { getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { createUserProfile, getUserProfile, patchUserProfile } from '../../src/services/userService';

describe('createUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls setDoc exactly once with only account-shape fields (no birthday/biography/photoURL)', async () => {
    vi.mocked(setDoc).mockResolvedValue(undefined);

    await createUserProfile('uid-1', { displayName: 'Ana', email: 'a@b.test', telephone: '600' });

    expect(setDoc).toHaveBeenCalledTimes(1);
    const [, payload] = vi.mocked(setDoc).mock.calls[0];

    // Must have all account-shape keys
    expect(payload).toHaveProperty('displayName', 'Ana');
    expect(payload).toHaveProperty('email', 'a@b.test');
    expect(payload).toHaveProperty('telephone', '600');
    expect(payload).toHaveProperty('activeMunicipalityId', null);
    expect(payload).toHaveProperty('personId', null);
    expect(payload).toHaveProperty('createdAt', '__SERVER_TIMESTAMP__');

    // Must NOT have dropped fields
    expect(payload).not.toHaveProperty('birthday');
    expect(payload).not.toHaveProperty('biography');
    expect(payload).not.toHaveProperty('photoURL');

    // Keys are EXACTLY the 6 account fields
    expect(Object.keys(payload as object).sort()).toEqual(
      ['activeMunicipalityId', 'createdAt', 'displayName', 'email', 'personId', 'telephone'],
    );
  });
});

describe('patchUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls updateDoc once with { personId } when patching personId', async () => {
    vi.mocked(updateDoc).mockResolvedValue(undefined);

    await patchUserProfile('uid-1', { personId: 'person-1' });

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [, payload] = vi.mocked(updateDoc).mock.calls[0];
    expect(payload).toEqual({ personId: 'person-1' });
  });

  it('calls updateDoc once with all provided fields including nulls', async () => {
    vi.mocked(updateDoc).mockResolvedValue(undefined);

    await patchUserProfile('uid-1', {
      displayName: 'Ana',
      telephone: null,
      activeMunicipalityId: null,
      personId: null,
    });

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [, payload] = vi.mocked(updateDoc).mock.calls[0];
    expect(payload).toEqual({
      displayName: 'Ana',
      telephone: null,
      activeMunicipalityId: null,
      personId: null,
    });
  });
});

describe('getUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the snapshot does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);

    const result = await getUserProfile('uid-1');

    expect(result).toBeNull();
  });

  it('returns a mapped object with account-shape fields and NO birthday/biography/photoURL', async () => {
    const fakeDate = new Date('2024-01-01T00:00:00Z');
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      id: 'uid-1',
      data: () => ({
        displayName: 'Ana',
        email: 'a@b.test',
        telephone: '600',
        activeMunicipalityId: 'muni-1',
        personId: 'person-1',
        createdAt: { toDate: () => fakeDate },
      }),
    } as any);

    const result = await getUserProfile('uid-1');

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      id: 'uid-1',
      displayName: 'Ana',
      email: 'a@b.test',
      telephone: '600',
      activeMunicipalityId: 'muni-1',
      personId: 'person-1',
      createdAt: fakeDate,
    });

    expect(result).not.toHaveProperty('birthday');
    expect(result).not.toHaveProperty('biography');
    expect(result).not.toHaveProperty('photoURL');
  });
});
