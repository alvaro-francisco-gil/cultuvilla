import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, ReauthRequiredError } from '../AuthContext';
import { useAuth } from '../useAuth';

const mockCurrentUser = {
  uid: 'user-1',
  email: 'old@example.com',
  providerData: [{ providerId: 'password' }],
};

// Mutable so individual tests can simulate a lapsed session (currentUser ===
// null) without re-declaring the whole @cultuvilla/shared/firebase mock.
const mockAuthState: { currentUser: typeof mockCurrentUser | null } = {
  currentUser: mockCurrentUser,
};

const mockVerifyBeforeUpdateEmail = jest.fn();
const mockSendSignInLinkToEmail = jest.fn();
const mockReauthenticateWithCredential = jest.fn();
const mockCredentialWithLink = jest.fn().mockReturnValue({ credential: true });

jest.mock('@cultuvilla/shared/firebase', () => ({
  getAuth: () => ({
    get currentUser() {
      return mockAuthState.currentUser;
    },
    onAuthStateChanged: (cb: (u: unknown) => void) => {
      cb(mockAuthState.currentUser);
      return () => {};
    },
  }),
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    cb(mockCurrentUser);
    return () => {};
  },
  sendSignInLinkToEmail: (...args: unknown[]) => mockSendSignInLinkToEmail(...args),
  isSignInWithEmailLink: jest.fn().mockReturnValue(true),
  signInWithEmailLink: jest.fn(),
  verifyBeforeUpdateEmail: (...args: unknown[]) => mockVerifyBeforeUpdateEmail(...args),
  reauthenticateWithCredential: (...args: unknown[]) => mockReauthenticateWithCredential(...args),
  EmailAuthProvider: {
    credentialWithLink: (...args: unknown[]) => mockCredentialWithLink(...args),
  },
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
  getUserProfile: jest.fn().mockResolvedValue({ id: 'user-1', email: 'old@example.com' }),
  patchUserProfile: jest.fn(),
  setActiveMunicipality: jest.fn(),
}));

jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  getUserMemberships: jest.fn().mockResolvedValue([]),
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      firebaseConfig: { authDomain: 'villa-events.firebaseapp.com' },
    },
  },
}));

describe('AuthContext changeEmail / re-auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.clear();
    mockAuthState.currentUser = mockCurrentUser;
  });

  it('calls verifyBeforeUpdateEmail with the new address', async () => {
    mockVerifyBeforeUpdateEmail.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await result.current.changeEmail('new@example.com');
    });

    expect(mockVerifyBeforeUpdateEmail).toHaveBeenCalledWith(mockCurrentUser, 'new@example.com');
  });

  it('persists a pending-reauth intent and sends a sign-in link on requires-recent-login', async () => {
    mockVerifyBeforeUpdateEmail.mockRejectedValueOnce({ code: 'auth/requires-recent-login' });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await expect(result.current.changeEmail('new@example.com')).rejects.toBeInstanceOf(
        ReauthRequiredError,
      );
    });

    expect(mockSendSignInLinkToEmail).toHaveBeenCalledWith(
      expect.anything(),
      'old@example.com',
      expect.objectContaining({ handleCodeInApp: true }),
    );

    const stored = await AsyncStorage.getItem('cultuvilla.pendingReauth');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string)).toEqual({
      purpose: 'change-email',
      newEmail: 'new@example.com',
    });
  });

  it('reauthenticates and replays verifyBeforeUpdateEmail for a change-email intent', async () => {
    await AsyncStorage.setItem(
      'cultuvilla.pendingReauth',
      JSON.stringify({ purpose: 'change-email', newEmail: 'new@example.com' }),
    );
    mockReauthenticateWithCredential.mockResolvedValueOnce(undefined);
    mockVerifyBeforeUpdateEmail.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await result.current.completeReauth('https://example.com/finish?mode=signIn');
    });

    expect(mockCredentialWithLink).toHaveBeenCalledWith(
      'old@example.com',
      'https://example.com/finish?mode=signIn',
    );
    expect(mockReauthenticateWithCredential).toHaveBeenCalledWith(
      mockCurrentUser,
      expect.objectContaining({ credential: true }),
    );
    expect(mockVerifyBeforeUpdateEmail).toHaveBeenCalledWith(mockCurrentUser, 'new@example.com');

    await waitFor(async () => {
      expect(await AsyncStorage.getItem('cultuvilla.pendingReauth')).toBeNull();
    });
  });

  it('clears the pending-reauth intent when the session has lapsed, instead of wedging it', async () => {
    await AsyncStorage.setItem(
      'cultuvilla.pendingReauth',
      JSON.stringify({ purpose: 'change-email', newEmail: 'new@example.com' }),
    );
    mockAuthState.currentUser = null;

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await expect(
        result.current.completeReauth('https://example.com/finish?mode=signIn'),
      ).rejects.toThrow('not-signed-in');
    });

    expect(mockReauthenticateWithCredential).not.toHaveBeenCalled();
    await waitFor(async () => {
      expect(await AsyncStorage.getItem('cultuvilla.pendingReauth')).toBeNull();
    });
  });

  it('gates change-email on ANY password/emailLink provider, not just the first', async () => {
    const { result, rerender } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.emailProvider).toBe('password');

    // Simulate a Google-then-email-linked account: google.com is first in
    // providerData, but a password provider is also attached.
    mockCurrentUser.providerData = [{ providerId: 'google.com' }, { providerId: 'password' }];
    mockAuthState.currentUser = mockCurrentUser;
    rerender({});

    await waitFor(() => expect(result.current.emailProvider).toBe('password'));

    // A Google-only account (no password/emailLink provider) must still be
    // gated OUT of change-email.
    mockCurrentUser.providerData = [{ providerId: 'google.com' }];
    mockAuthState.currentUser = mockCurrentUser;
    rerender({});

    await waitFor(() => expect(result.current.emailProvider).toBe('google.com'));
  });
});
