/* eslint-disable @typescript-eslint/no-unsafe-argument,
                  @typescript-eslint/no-unsafe-assignment */
// vi.mock factories legitimately fake the firebase/firestore SDK shape;
// the rule family doesn't add value for these inline mocks.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getDb: vi.fn() }));
vi.mock('../../src/firebase/refs/client', () => ({
  organizationMembersCollection: vi.fn((_db, orgId) => ({ _orgId: orgId })),
  organizationMemberDoc: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  getCountFromServer: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

import { getCountFromServer, setDoc, updateDoc } from 'firebase/firestore';
import { organizationMembersCollection } from '../../src/firebase/refs/client';
import {
  getOrgMemberCount,
  addOrgMember,
  setOrgMemberRole,
  getOrgAdminIds,
} from '../../src/services/orgMemberService';

describe('getOrgMemberCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the server-side member count for the org', async () => {
    vi.mocked(getCountFromServer).mockResolvedValue({
      data: () => ({ count: 12 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const n = await getOrgMemberCount('org-1');

    expect(organizationMembersCollection).toHaveBeenCalledWith(undefined, 'org-1');
    expect(n).toBe(12);
  });
});

describe('orgMemberService roles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('addOrgMember writes role member by default', async () => {
    vi.mocked(setDoc).mockResolvedValue(undefined);
    await addOrgMember('org1', 'u1');
     
    const arg = (setDoc as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(arg).toMatchObject({ role: 'member' });
  });

  it('addOrgMember can seed an admin', async () => {
    vi.mocked(setDoc).mockResolvedValue(undefined);
    await addOrgMember('org1', 'creator', 'admin');
     
    const arg = (setDoc as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(arg).toMatchObject({ role: 'admin' });
  });

  it('setOrgMemberRole updates only the role', async () => {
    vi.mocked(updateDoc).mockResolvedValue(undefined);
    await setOrgMemberRole('org1', 'u1', 'admin');
    const patch = (updateDoc as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(patch).toEqual({ role: 'admin' });
  });
});

describe('getOrgAdminIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ids of members with admin role', async () => {
    const { getDocs } = await import('firebase/firestore');
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: 'u1', data: () => ({ joinedAt: new Date(), role: 'admin' }) },
        { id: 'u2', data: () => ({ joinedAt: new Date(), role: 'member' }) },
        { id: 'u3', data: () => ({ joinedAt: new Date(), role: 'admin' }) },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const adminIds = await getOrgAdminIds('org1');
    expect(adminIds).toEqual(['u1', 'u3']);
  });
});
