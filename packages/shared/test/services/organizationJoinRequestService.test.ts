import { describe, it, expect, vi, beforeEach } from 'vitest';

const callable = vi.fn().mockResolvedValue({ data: { ok: true, requestId: 'r1' } });
vi.mock('firebase/functions', () => ({ httpsCallable: () => callable }));
vi.mock('../../src/firebase', () => ({ getDb: () => ({}), getFirebaseFunctions: () => ({}) }));

import { requestJoinOrganization } from '../../src/services/organizationJoinRequestService';

beforeEach(() => callable.mockClear());

describe('organizationJoinRequestService', () => {
  it('requestJoinOrganization invokes the callable with orgId and returns requestId', async () => {
    const res = await requestJoinOrganization('org1');
    expect(callable).toHaveBeenCalledWith({ orgId: 'org1' });
    expect(res.requestId).toBe('r1');
  });
});
