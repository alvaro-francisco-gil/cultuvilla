 
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getDb: vi.fn(), getFirebaseFunctions: vi.fn(() => ({})) }));
vi.mock('../../src/firebase/refs/client', () => ({
  organizationsCollection: vi.fn((_db) => ({})),
  organizationDoc: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn(),
}));
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }));

import { query, where, orderBy, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { approveOrganization, getMyOrganizations } from '../../src/services/organizationService';

// Approval moved server-side (approveOrganization callable): the client service
// is now a thin wrapper. The status flip + founding-admin seed + audit are
// covered by the functions handler test, not here.
describe('approveOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes the approveOrganization callable with the orgId', async () => {
    const call = vi.fn().mockResolvedValue({ data: { ok: true } });
    vi.mocked(httpsCallable).mockReturnValue(call as unknown as ReturnType<typeof httpsCallable>);
    await approveOrganization('org1');
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'approveOrganization');
    expect(call).toHaveBeenCalledWith({ orgId: 'org1' });
  });
});

describe('getMyOrganizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(query).mockReturnValue({} as ReturnType<typeof query>);
    vi.mocked(getDocs).mockResolvedValue({
      docs: [{ id: 'o1', data: () => ({ name: 'A' }) }],
    } as unknown as Awaited<ReturnType<typeof getDocs>>);
  });

  it('calls where with requestedBy and orderBy with createdAt desc', async () => {
    await getMyOrganizations('user123');
    expect(where).toHaveBeenCalledWith('requestedBy', '==', 'user123');
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
  });

  it('maps snapshot docs to { id, ...data() }', async () => {
    const result = await getMyOrganizations('user123');
    expect(result).toEqual([{ id: 'o1', name: 'A' }]);
  });
});
