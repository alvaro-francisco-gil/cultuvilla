import { describe, expect, it, jest } from '@jest/globals';

const initFirebase = jest.fn();
const initializeAuth = jest.fn((_app: unknown, opts: unknown) => opts);
const getReactNativePersistence = jest.fn((storage: unknown) => ({ rnPersistence: storage }));

function mockModules(platformOS: 'ios' | 'android'): void {
  jest.resetModules();
  initFirebase.mockClear();
  initializeAuth.mockClear();
  getReactNativePersistence.mockClear();

  jest.doMock('react-native', () => ({ Platform: { OS: platformOS } }));
  jest.doMock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: { asyncStorageMarker: true },
  }));
  jest.doMock('@firebase/auth', () => ({ initializeAuth, getReactNativePersistence }));
  jest.doMock('firebase/auth', () => ({ connectAuthEmulator: jest.fn() }));
  jest.doMock('firebase/firestore', () => ({ connectFirestoreEmulator: jest.fn() }));
  jest.doMock('firebase/functions', () => ({ connectFunctionsEmulator: jest.fn() }));
  jest.doMock('firebase/storage', () => ({ connectStorageEmulator: jest.fn() }));
  jest.doMock('@firebase/util', () => ({ FirebaseError: class FirebaseError extends Error {} }));
  jest.doMock('../appCheck', () => ({ initMobileAppCheck: jest.fn() }));
  jest.doMock('@cultuvilla/shared/firebase', () => ({
    initFirebase,
    getAuth: jest.fn(),
    getDb: jest.fn(),
    getFirebaseFunctions: jest.fn(),
    getFirebaseStorage: jest.fn(),
  }));
  jest.doMock('expo-constants', () => ({
    __esModule: true,
    default: { expoConfig: { extra: { firebaseConfig: { projectId: 'test-project' } } } },
  }));
}

describe('bootstrapFirebase', () => {

  it('uses AsyncStorage-backed persistence on native', () => {
    mockModules('ios');
    const { bootstrapFirebase } = require('../firebaseInit');
    bootstrapFirebase();

    expect(initFirebase).toHaveBeenCalledTimes(1);
    const { customizeAuth } = initFirebase.mock.calls[0]![1] as {
      customizeAuth: (app: unknown) => unknown;
    };
    customizeAuth({});
    expect(getReactNativePersistence).toHaveBeenCalledWith({ asyncStorageMarker: true });
    expect(initializeAuth).toHaveBeenCalledWith(
      {},
      { persistence: { rnPersistence: { asyncStorageMarker: true } } },
    );
  });
});
