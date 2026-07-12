import { createAnalyticsBackend } from '../analytics';

describe('native analytics stub', () => {
  it('exposes the backend shape and never throws', () => {
    const b = createAnalyticsBackend();
    expect(() => {
      b.trackEvent('village.join.success', { villageId: 'v1' }, 'hash1');
      b.setConsent(true);
      b.setUserId('hash1');
    }).not.toThrow();
  });
});
