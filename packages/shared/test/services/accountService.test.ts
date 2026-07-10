import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getFirebaseFunctions: vi.fn(() => ({})) }));
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }));

import { httpsCallable } from 'firebase/functions';
import { checkAccountDeletable, deleteAccount } from '../../src/services/accountService';

describe('checkAccountDeletable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes the checkAccountDeletable callable and returns its blockers', async () => {
    const blockers = [{ scopeType: 'village' as const, scopeId: 'v1', name: 'Villa' }];
    const call = vi.fn().mockResolvedValue({ data: { blockers } });
    vi.mocked(httpsCallable).mockReturnValue(call as unknown as ReturnType<typeof httpsCallable>);

    const result = await checkAccountDeletable();

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'checkAccountDeletable');
    expect(call).toHaveBeenCalledWith();
    expect(result).toEqual({ blockers });
  });
});

describe('deleteAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes the deleteAccount callable and returns its result', async () => {
    const call = vi.fn().mockResolvedValue({ data: { ok: true } });
    vi.mocked(httpsCallable).mockReturnValue(call as unknown as ReturnType<typeof httpsCallable>);

    const result = await deleteAccount();

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'deleteAccount');
    expect(call).toHaveBeenCalledWith();
    expect(result).toEqual({ ok: true });
  });
});
