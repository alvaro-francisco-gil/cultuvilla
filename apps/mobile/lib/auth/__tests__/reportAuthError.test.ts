import { observability } from '@cultuvilla/shared';
import { reportAuthError, isCancelledAuthError } from '../reportAuthError';

jest.mock('@cultuvilla/shared', () => ({
  observability: { captureError: jest.fn() },
}));

const captureError = observability.captureError as jest.Mock;

function withCode(message: string, code: string): Error {
  const e = new Error(message) as Error & { code?: string };
  e.code = code;
  return e;
}

describe('reportAuthError', () => {
  beforeEach(() => captureError.mockClear());

  it('reports a native Apple failure with the operation that produced it', () => {
    // The exact shape behind Apple's own "no se ha completado el registro"
    // dialog: signInAsync aborts before Firebase is ever called, so the code
    // is Expo's, not a Firebase auth/* one.
    const err = withCode('The authorization attempt failed', 'ERR_APPLE_AUTHENTICATION_REQUEST_FAILED');
    reportAuthError('auth:signInWithApple', err);
    expect(captureError).toHaveBeenCalledTimes(1);
    const [reported, context] = captureError.mock.calls[0];
    expect(reported).toBe(err);
    expect(context).toEqual({ operation: 'auth:signInWithApple', surface: 'auth' });
  });

  it('reports a Firebase provider rejection', () => {
    reportAuthError('auth:signInWithApple', withCode('Firebase: Error', 'auth/operation-not-allowed'));
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the person cancelled', () => {
    for (const code of ['auth/cancelled', 'ERR_REQUEST_CANCELED', 'auth/popup-closed-by-user']) {
      reportAuthError('auth:signInWithApple', withCode('cancelled', code));
    }
    expect(captureError).not.toHaveBeenCalled();
  });

  it('reports an error carrying no code at all', () => {
    reportAuthError('auth:verifyOtpCode', new Error('boom'));
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it('isCancelledAuthError tolerates non-error values', () => {
    expect(isCancelledAuthError(null)).toBe(false);
    expect(isCancelledAuthError('nope')).toBe(false);
    expect(isCancelledAuthError({ code: 42 })).toBe(false);
  });
});
