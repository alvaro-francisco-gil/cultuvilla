import {
  clearPendingToken,
  getPendingToken,
  rememberPendingToken,
  shouldRetainToken,
} from '../otpTokenCache';

beforeEach(() => {
  clearPendingToken();
});

describe('pending token storage', () => {
  it('has nothing pending by default', () => {
    expect(getPendingToken('ana@example.com')).toBeNull();
  });

  it('returns the token remembered for that email', () => {
    rememberPendingToken('ana@example.com', 'token-1');

    expect(getPendingToken('ana@example.com')).toBe('token-1');
  });

  // A token is minted for one specific account; handing it to a different email
  // would sign the user into the wrong account.
  it('does not hand a token to a different email', () => {
    rememberPendingToken('ana@example.com', 'token-1');

    expect(getPendingToken('bruno@example.com')).toBeNull();
  });

  it('drops the token once cleared', () => {
    rememberPendingToken('ana@example.com', 'token-1');
    clearPendingToken();

    expect(getPendingToken('ana@example.com')).toBeNull();
  });

  it('keeps only the most recent token', () => {
    rememberPendingToken('ana@example.com', 'token-1');
    rememberPendingToken('bruno@example.com', 'token-2');

    expect(getPendingToken('ana@example.com')).toBeNull();
    expect(getPendingToken('bruno@example.com')).toBe('token-2');
  });
});

describe('shouldRetainToken', () => {
  // The point of the cache: the OTP is already spent when sign-in fails, so a
  // connection blip must not cost the user their code.
  it('retains the token when sign-in died on the network', () => {
    const error = Object.assign(new Error('Firebase: Error (auth/network-request-failed).'), {
      code: 'auth/network-request-failed',
    });

    expect(shouldRetainToken(error)).toBe(true);
  });

  it('retains on a timeout', () => {
    expect(shouldRetainToken(Object.assign(new Error('t'), { code: 'auth/timeout' }))).toBe(true);
  });

  // The other half: a token that can never work must be discarded, or the retry
  // path loops forever on a dead credential instead of requesting a new code.
  it.each([
    'auth/invalid-custom-token',
    'auth/custom-token-mismatch',
    'auth/user-disabled',
  ])('discards the token after %s', (code) => {
    expect(shouldRetainToken(Object.assign(new Error('nope'), { code }))).toBe(false);
  });

  it('discards the token for an unclassifiable failure', () => {
    expect(shouldRetainToken(new Error('something odd'))).toBe(false);
    expect(shouldRetainToken(undefined)).toBe(false);
  });
});
