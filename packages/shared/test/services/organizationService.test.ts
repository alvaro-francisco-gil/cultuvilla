 
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getDb: vi.fn(), getFirebaseFunctions: vi.fn(() => ({})) }));
vi.mock('../../src/firebase/refs/client', () => ({
  organizationsCollection: vi.fn((_db) => ({})),
  organizationDoc: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn(),
}));
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }));

import { doc, query, where, orderBy, getDocs, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  approveOrganization,
  getMyOrganizations,
  requestOrganization,
} from '../../src/services/organizationService';

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

describe('requestOrganization membersPublic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doc).mockReturnValue({ id: 'o1' } as ReturnType<typeof doc>);
  });

  it('defaults membersPublic to true when omitted', async () => {
    await requestOrganization({
      id: 'o1', name: 'Peña', type: 'peña', municipalityId: 'm1', requestedBy: 'u1',
    });
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ membersPublic: true }),
    );
  });

  it('persists membersPublic false when provided', async () => {
    await requestOrganization({
      id: 'o1', name: 'Peña', type: 'peña', municipalityId: 'm1', requestedBy: 'u1',
      membersPublic: false,
    });
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ membersPublic: false }),
    );
  });
});
