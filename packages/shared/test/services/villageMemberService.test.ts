/* eslint-disable @typescript-eslint/no-unsafe-argument,
                  @typescript-eslint/no-explicit-any,
                  @typescript-eslint/require-await */
// vi.mock factories legitimately fake the firebase/firestore SDK shape;
// the rule family doesn't add value for these inline mocks.
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
    collectionGroup: vi.fn((..._args) => makeRef(..._args)),
    doc: vi.fn((..._args) => makeRef(..._args)),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    serverTimestamp: () => '__SERVER_TIMESTAMP__',
    where: vi.fn(),
    query: vi.fn(),
  };
});

import { setDoc, updateDoc } from 'firebase/firestore';
import { joinVillage } from '../../src/services/villageMemberService';

describe('joinVillage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the membership AND sets the joined village as the active village', async () => {
    vi.mocked(setDoc).mockResolvedValue(undefined);
    vi.mocked(updateDoc).mockResolvedValue(undefined);

    await joinVillage('muni-1', 'uid-1', 'barrio-1');

    // member doc created
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [, memberPayload] = vi.mocked(setDoc).mock.calls[0];
    expect(memberPayload).toMatchObject({ userId: 'uid-1', role: 'user', barrioId: 'barrio-1' });

    // joined village becomes the active village (the bug: this was never set)
    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [, userPayload] = vi.mocked(updateDoc).mock.calls[0];
    expect(userPayload).toEqual({ activeMunicipalityId: 'muni-1' });
  });
});
