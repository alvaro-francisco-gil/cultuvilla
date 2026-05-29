import { FirebaseError } from '@firebase/util';
import { withFirestoreErrorLog } from '../lib/firestoreErrorLog';

// Mock @firebase/auth so getAuth().currentUser is controllable.
jest.mock('@firebase/auth', () => ({
  getAuth: () => ({ currentUser: { uid: 'test-uid' } }),
}));

declare const globalThis: { __DEV__?: boolean } & typeof global;

describe('withFirestoreErrorLog', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    globalThis.__DEV__ = true;
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('returns the value when op resolves', async () => {
    const result = await withFirestoreErrorLog('test:ok', async () => 42);
    expect(result).toBe(42);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs label/code/uid and rethrows on permission-denied', async () => {
    const err = new FirebaseError('permission-denied', 'Missing or insufficient permissions.');
    await expect(
      withFirestoreErrorLog('test:deny', async () => {
        throw err;
      }),
    ).rejects.toBe(err);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = warn.mock.calls[0][0] as string;
    expect(line).toContain('[firestore-deny]');
    expect(line).toContain('label=test:deny');
    expect(line).toContain('code=permission-denied');
    expect(line).toContain('uid=test-uid');
  });

  it('does not log for non-Firebase errors but still rethrows', async () => {
    const err = new Error('boom');
    await expect(
      withFirestoreErrorLog('test:other', async () => {
        throw err;
      }),
    ).rejects.toBe(err);
    expect(warn).not.toHaveBeenCalled();
  });

  it('is a pass-through when __DEV__ is false', async () => {
    globalThis.__DEV__ = false;
    const err = new FirebaseError('permission-denied', 'denied');
    await expect(
      withFirestoreErrorLog('test:prod', async () => {
        throw err;
      }),
    ).rejects.toBe(err);
    expect(warn).not.toHaveBeenCalled();
  });
});
