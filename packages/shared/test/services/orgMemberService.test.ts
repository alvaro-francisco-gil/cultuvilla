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
}));

import { getCountFromServer } from 'firebase/firestore';
import { organizationMembersCollection } from '../../src/firebase/refs/client';
import { getOrgMemberCount } from '../../src/services/orgMemberService';

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
