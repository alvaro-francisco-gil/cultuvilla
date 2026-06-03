import { renderHook, act } from '@testing-library/react-native';
import { AuthProvider } from '../AuthContext';
import { useAuth } from '../useAuth';

jest.mock('@cultuvilla/shared/firebase', () => ({
  getAuth: () => ({
    onAuthStateChanged: (cb: (u: unknown) => void) => {
      cb(null);
      return () => {};
    },
  }),
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    cb(null);
    return () => {};
  },
  sendSignInLinkToEmail: jest.fn(),
  isSignInWithEmailLink: jest.fn().mockReturnValue(false),
  signInWithEmailLink: jest.fn(),
  GoogleAuthProvider: class {
    static credential() {
      return {};
    }
  },
  signInWithCredential: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('@cultuvilla/shared/services/userService', () => ({
  getUserProfile: jest.fn().mockResolvedValue(null),
}));

describe('AuthProvider', () => {
  it('exposes a null user before sign-in', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
