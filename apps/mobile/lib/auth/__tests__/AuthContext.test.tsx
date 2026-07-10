import { renderHook, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../AuthContext';
import { useAuth } from '../useAuth';
import { observability } from '@cultuvilla/shared';
import { fetchUserIdHash } from '../../observability/errorBridge';

const FAKE_UID = 'user-raw-uid-123';
const FAKE_HASH = 'a'.repeat(64);

let mockAuthUser: { uid: string; email: string | null } | null = { uid: FAKE_UID, email: 'a@b.com' };

jest.mock('@cultuvilla/shared/firebase', () => ({
  getAuth: () => ({
    // `getAuth().currentUser` — the live source of truth the raw-uid guard
    // re-checks against before applying the hashed user context.
    get currentUser() {
      return mockAuthUser;
    },
    onAuthStateChanged: (cb: (u: unknown) => void) => {
      cb(mockAuthUser);
      return () => {};
    },
  }),
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    cb(mockAuthUser);
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
  getUserProfile: jest.fn().mockResolvedValue({ activeMunicipalityId: 'm1' }),
  setActiveMunicipality: jest.fn(),
  patchUserProfile: jest.fn(),
}));

jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  getUserMemberships: jest.fn().mockResolvedValue([]),
}));

jest.mock('@cultuvilla/shared/services/listenerManager', () => ({
  clearAll: jest.fn(),
}));

jest.mock('../../observability/errorBridge', () => ({
  fetchUserIdHash: jest.fn(),
}));

jest.mock('@cultuvilla/shared', () => ({
  observability: {
    setUserContext: jest.fn(),
    setConsent: jest.fn(),
  },
}));

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = { uid: FAKE_UID, email: 'a@b.com' };
  });

  it('exposes a null user before sign-in', () => {
    mockAuthUser = null;
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('never forwards the raw uid to observability.setUserContext — only the resolved hash', async () => {
    (fetchUserIdHash as jest.Mock).mockResolvedValue(FAKE_HASH);
    renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(observability.setUserContext).toHaveBeenCalledWith(
        expect.objectContaining({ uid: FAKE_HASH }),
      );
    });

    for (const call of (observability.setUserContext as jest.Mock).mock.calls) {
      const arg = call[0];
      if (arg !== null) {
        expect(arg.uid).not.toBe(FAKE_UID);
      }
    }
  });

  it('does not apply the resolved hash if the account changed mid-fetch', async () => {
    (fetchUserIdHash as jest.Mock).mockImplementation(async () => {
      // Simulate a sign-out/account-switch racing the hash fetch.
      mockAuthUser = { uid: 'a-different-uid', email: null };
      return FAKE_HASH;
    });
    renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(fetchUserIdHash).toHaveBeenCalled();
    });

    // Give the microtask queue a chance to flush the .then().
    await new Promise((r) => setTimeout(r, 0));

    for (const call of (observability.setUserContext as jest.Mock).mock.calls) {
      const arg = call[0];
      if (arg !== null) {
        expect(arg.uid).not.toBe(FAKE_UID);
      }
    }
  });

  it('grants analytics consent when the loaded profile has accepted the terms', async () => {
    const { getUserProfile } = jest.requireMock('@cultuvilla/shared/services/userService');
    (getUserProfile as jest.Mock).mockResolvedValueOnce({
      activeMunicipalityId: 'm1',
      termsAcceptedAt: new Date(),
    });
    renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(observability.setConsent).toHaveBeenCalledWith({ analytics: true });
    });
  });

  it('withdraws analytics consent when signed out', () => {
    mockAuthUser = null;
    renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(observability.setConsent).toHaveBeenCalledWith({ analytics: false });
  });
});
