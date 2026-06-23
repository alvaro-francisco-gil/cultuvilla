 
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
}));
vi.mock('../../src/services/orgMemberService', () => ({
  addOrgMember: vi.fn(),
}));

import { updateDoc } from 'firebase/firestore';
import * as orgMember from '../../src/services/orgMemberService';
import { approveOrganization } from '../../src/services/organizationService';

describe('approveOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateDoc).mockResolvedValue(undefined);
    vi.mocked(orgMember.addOrgMember).mockResolvedValue(undefined);
  });

  it('flips status to approved and records approvedBy', async () => {
    await approveOrganization('org1', 'vadmin', 'creator');
    expect(updateDoc).toHaveBeenCalledTimes(1);
    const patch = vi.mocked(updateDoc).mock.calls[0][1];
    expect(patch).toMatchObject({ status: 'approved', approvedBy: 'vadmin' });
  });

  it('approveOrganization seeds requestedBy as an org admin', async () => {
    const spy = vi.spyOn(orgMember, 'addOrgMember').mockResolvedValue();
    await approveOrganization('org1', 'vadmin', 'creator');
    expect(spy).toHaveBeenCalledWith('org1', 'creator', 'admin');
  });
});
