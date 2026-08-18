import { authErrorMessage } from '../authErrorMessage';

const FALLBACK = 'auth.error.unknown';

describe('authErrorMessage', () => {
  // The bug this function exists for: a flaky connection during OTP sign-in
  // threw `auth/network-request-failed`, and the login screen rendered the raw
  // SDK string at the user.
  describe('network failures (the bad-connection signup bug)', () => {
    it('turns auth/network-request-failed into the "sin conexión" copy', () => {
      const error = Object.assign(
        new Error('Firebase: Error (auth/network-request-failed).'),
        { code: 'auth/network-request-failed' },
      );

      const message = authErrorMessage(error, FALLBACK);

      expect(message).toMatch(/conexión/i);
      expect(message).not.toMatch(/Firebase:/);
      expect(message).not.toMatch(/auth\//);
    });

    it('classifies auth/timeout as a connection problem too', () => {
      const error = Object.assign(new Error('Firebase: Error (auth/timeout).'), {
        code: 'auth/timeout',
      });

      expect(authErrorMessage(error, FALLBACK)).toMatch(/conexión/i);
    });

    it('classifies a network failure that arrives with no code, only a message', () => {
      // The SDK sometimes drops the code on the way through the callable layer.
      const message = authErrorMessage(new Error('Network request failed'), FALLBACK);

      expect(message).toMatch(/conexión/i);
    });
  });

  describe('raw SDK strings never reach the user', () => {
    it.each([
      'Firebase: Error (auth/internal-error).',
      'Firebase: Error (auth/invalid-credential).',
      'Firebase: An unexpected error occurred.',
    ])('falls back rather than rendering %s', (raw) => {
      // These carry no code, so they land in the "unknown" bucket. Without the
      // Firebase: guard they would be shown verbatim.
      expect(authErrorMessage(new Error(raw), FALLBACK)).toBe(FALLBACK);
    });
  });

  describe('server-authored copy is preserved', () => {
    // Regression guard: routing everything through the classifier would replace
    // these specific, useful messages with a generic "algo ha fallado".
    it('keeps the OTP rejection message from verifyAuthOtpCode', () => {
      const error = Object.assign(new Error('Código incorrecto o caducado.'), {
        code: 'functions/invalid-argument',
      });

      expect(authErrorMessage(error, FALLBACK)).toBe('Código incorrecto o caducado.');
    });

    it('keeps a plain Spanish validation message', () => {
      expect(authErrorMessage(new Error('Email inválido.'), FALLBACK)).toBe('Email inválido.');
    });
  });

  describe('internal sentinels are not user copy', () => {
    it.each(['email-required', 'not-signed-in'])('falls back for the %s sentinel', (sentinel) => {
      expect(authErrorMessage(new Error(sentinel), FALLBACK)).toBe(FALLBACK);
    });
  });

  it('falls back for a thrown non-Error with nothing usable', () => {
    expect(authErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(authErrorMessage(new Error('   '), FALLBACK)).toBe(FALLBACK);
  });

  it('surfaces a permission failure as permission copy, not a connection problem', () => {
    const error = Object.assign(new Error('Firebase: Error (auth/user-disabled).'), {
      code: 'auth/user-disabled',
    });

    expect(authErrorMessage(error, FALLBACK)).toMatch(/permiso/i);
  });
});
