 
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getDb: vi.fn() }));
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
vi.mock('../../src/services/orgMemberService', () => ({
  addOrgMember: vi.fn(),
}));

import { updateDoc, query, where, orderBy, getDocs } from 'firebase/firestore';
import * as orgMember from '../../src/services/orgMemberService';
import { approveOrganization, getMyOrganizations } from '../../src/services/organizationService';

describe('approveOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateDoc).mockResolvedValue(undefined);
    vi.mocked(orgMember.addOrgMember).mockResolvedValue(undefined);
  });

  it('flips status to approved and records reviewedBy', async () => {
    await approveOrganization('org1', 'vadmin', 'creator');
    expect(updateDoc).toHaveBeenCalledTimes(1);
    const patch = vi.mocked(updateDoc).mock.calls[0][1];
    expect(patch).toMatchObject({ status: 'approved', reviewedBy: 'vadmin' });
  });

  it('approveOrganization seeds requestedBy as an org admin', async () => {
    const spy = vi.spyOn(orgMember, 'addOrgMember').mockResolvedValue();
    await approveOrganization('org1', 'vadmin', 'creator');
    expect(spy).toHaveBeenCalledWith('org1', 'creator', 'admin');
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
