import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getFirebaseFunctions: vi.fn(() => ({})) }));

const callableFn = vi.fn().mockResolvedValue({ data: { status: 'active' } });
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => callableFn) }));

import { httpsCallable } from 'firebase/functions';
import { hideContent, unhideContent } from '../../src/services/moderationService';

describe('moderationService', () => {
  beforeEach(() => {
    vi.mocked(httpsCallable).mockClear();
    callableFn.mockClear();
  });

  it('hideContent calls setContentVisibility with hidden:true', async () => {
    await hideContent({ collection: 'news', docId: 'n1', reason: 'spam' });

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'setContentVisibility');
    expect(callableFn).toHaveBeenCalledWith({
      collection: 'news',
      docId: 'n1',
      hidden: true,
      reason: 'spam',
      municipalityId: undefined,
    });
  });

  it('hideContent forwards municipalityId for nested collections', async () => {
    await hideContent({ collection: 'barrios', docId: 'b1', municipalityId: 'm1' });

    expect(callableFn).toHaveBeenCalledWith({
      collection: 'barrios',
      docId: 'b1',
      hidden: true,
      reason: undefined,
      municipalityId: 'm1',
    });
  });

  it('unhideContent calls setContentVisibility with hidden:false', async () => {
    await unhideContent({ collection: 'places', docId: 'p1', municipalityId: 'm1' });

    expect(callableFn).toHaveBeenCalledWith({
      collection: 'places',
      docId: 'p1',
      hidden: false,
      municipalityId: 'm1',
    });
  });
});
