import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getFirebaseFunctions: vi.fn(() => ({})) }));

const callableFn = vi.fn().mockResolvedValue({ data: { ok: true } });
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => callableFn) }));

import { httpsCallable } from 'firebase/functions';
import {
  sendAuthSignInEmail,
  sendAuthOtpCode,
  verifyAuthOtpCode,
} from '../../src/services/authEmailService';

describe('authEmailService', () => {
  beforeEach(() => {
    vi.mocked(httpsCallable).mockClear();
    callableFn.mockClear();
    callableFn.mockResolvedValue({ data: { ok: true } });
  });

  it('sendAuthSignInEmail calls the sendAuthSignInEmail callable with email + continueUrl', async () => {
    await sendAuthSignInEmail('alice@example.com', 'https://cultuvilla.web.app/finish');

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'sendAuthSignInEmail');
    expect(callableFn).toHaveBeenCalledWith({
      email: 'alice@example.com',
      continueUrl: 'https://cultuvilla.web.app/finish',
    });
  });

  it('sendAuthOtpCode calls the sendAuthOtpCode callable with just the email', async () => {
    await sendAuthOtpCode('bob@example.com');

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'sendAuthOtpCode');
    expect(callableFn).toHaveBeenCalledWith({ email: 'bob@example.com' });
  });

  it('verifyAuthOtpCode calls the verifyAuthOtpCode callable and returns the token', async () => {
    callableFn.mockResolvedValue({ data: { token: 'custom-token-123' } });

    const token = await verifyAuthOtpCode('carol@example.com', '123456');

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'verifyAuthOtpCode');
    expect(callableFn).toHaveBeenCalledWith({ email: 'carol@example.com', code: '123456' });
    expect(token).toBe('custom-token-123');
  });
});
