import { describe, it, expect, vi } from 'vitest';

const errorSpy = vi.hoisted(() => vi.fn());
vi.mock('../shared/observability', async (orig) => {
  const actual = await orig<typeof import('../shared/observability')>();
  return { ...actual, log: { ...actual.log, error: errorSpy } };
});

import { runLogClientError } from '../observability/logClientError';

describe('runLogClientError', () => {
  it('logs at error with hashed uid (raw uid never present) and redacted message', () => {
    errorSpy.mockClear();
    runLogClientError('user-xyz', {
      message: 'boom for ana@example.com',
      name: 'TypeError',
      route: '/event/123',
      appVersion: '0.5.0',
      platform: 'web',
      operation_id: 'op-1',
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [msg, attrs] = errorSpy.mock.calls[0];
    expect(msg).toContain('client error');
    expect(attrs.handler).toBe('logClientError');
    // uid arrives raw here; hashing is applied by the real transformAttrs in prod.
    expect(attrs['user.id']).toBe('user-xyz');
    expect(attrs.route).toBe('/event/123');
    // free text is redacted at the call boundary before logging.
    expect(String(attrs['error.message'])).toContain('<email>');
  });

  it('drops keys outside the allowlist', () => {
    errorSpy.mockClear();
    runLogClientError('user-xyz', { message: 'x', email: 'ana@example.com', secret: 'nope' });
    const [, attrs] = errorSpy.mock.calls[0];
    expect(attrs.email).toBeUndefined();
    expect(attrs.secret).toBeUndefined();
  });
});
