/* eslint-disable @typescript-eslint/no-unsafe-argument,
                  @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-extraneous-class,
                  @typescript-eslint/require-await */
// vi.mock factories legitimately fake the firebase/firestore SDK shape;
// the rule family doesn't add value for these inline mocks.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getDb: vi.fn() }));
vi.mock('firebase/firestore', async () => {
  const makeRef = (..._args: unknown[]) => {
    const ref = { _path: _args, withConverter: vi.fn() };
    ref.withConverter.mockReturnValue(ref);
    return ref;
  };
  return {
    collection: vi.fn((..._args) => makeRef(..._args)),
    doc: vi.fn((..._args) => makeRef(..._args)),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    serverTimestamp: () => '__SERVER_TIMESTAMP__',
    Timestamp: { fromDate: (d: Date) => ({ toDate: () => d, _d: d }) },
    GeoPoint: class {},
    query: vi.fn((_col, ...constraints) => ({ _constraints: constraints })),
    orderBy: vi.fn((field, dir) => ({ _orderBy: field, _dir: dir })),
    where: vi.fn((field, op, value) => ({ _where: field, _op: op, _value: value })),
    getCountFromServer: vi.fn(),
  };
});

import { getCountFromServer, where, orderBy } from 'firebase/firestore';
import { getEventCountByCreator } from '../../src/services/eventService';

describe('getEventCountByCreator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters events by createdBy and returns the server count', async () => {
    vi.mocked(getCountFromServer).mockResolvedValue({
      data: () => ({ count: 7 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const n = await getEventCountByCreator('uid-1');

    expect(where).toHaveBeenCalledWith('createdBy', '==', 'uid-1');
    expect(n).toBe(7);
    // No ordering required for a count
    expect(orderBy).not.toHaveBeenCalled();
  });
});
