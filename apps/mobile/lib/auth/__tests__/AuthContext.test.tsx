import { act, renderHook, waitFor } from '@testing-library/react-native';
import { signOut as fbSignOut } from 'firebase/auth';
import { AuthProvider } from '../AuthContext';
import { useAuth } from '../useAuth';
import { observability } from '@cultuvilla/shared';
import { fetchUserIdHash } from '../../observability/errorBridge';

const FAKE_UID = 'user-raw-uid-123';
const FAKE_HASH = 'a'.repeat(64);

interface MockAuthUser {
  uid: string;
  email: string | null;
  delete?: jest.Mock;
}

let mockAuthUser: MockAuthUser | null = { uid: FAKE_UID, email: 'a@b.com' };

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

import { getUserProfile } from '@cultuvilla/shared/services/userService';

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
  },
}));

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = { uid: FAKE_UID, email: 'a@b.com', delete: jest.fn().mockResolvedValue(undefined) };
    (getUserProfile as jest.Mock).mockResolvedValue({ activeMunicipalityId: 'm1' });
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
});

describe('abandonSignUp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // An earlier test leaves fetchUserIdHash reassigning mockAuthUser mid-fetch.
    (fetchUserIdHash as jest.Mock).mockResolvedValue(FAKE_HASH);
    mockAuthUser = { uid: FAKE_UID, email: 'wrong@b.com', delete: jest.fn().mockResolvedValue(undefined) };
    (getUserProfile as jest.Mock).mockResolvedValue({ activeMunicipalityId: 'm1' });
  });

  it('deletes the account when no profile doc exists yet', async () => {
    // No profile == the Auth user was created by this very sign-in
    // (verifyAuthOtpCode), so nobody else owns that address.
    (getUserProfile as jest.Mock).mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.profileChecked).toBe(true));

    const deleteFn = mockAuthUser!.delete!;
    await act(async () => {
      await result.current.abandonSignUp();
    });

    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(fbSignOut).not.toHaveBeenCalled();
  });

  it('only signs out when the account already has a profile', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.profile).not.toBeNull());

    const deleteFn = mockAuthUser!.delete!;
    await act(async () => {
      await result.current.abandonSignUp();
    });

    expect(deleteFn).not.toHaveBeenCalled();
    expect(fbSignOut).toHaveBeenCalledTimes(1);
  });

  it('falls back to a plain sign-out when the delete is refused', async () => {
    (getUserProfile as jest.Mock).mockResolvedValue(null);
    mockAuthUser!.delete = jest.fn().mockRejectedValue(new Error('auth/requires-recent-login'));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.profileChecked).toBe(true));

    await act(async () => {
      await result.current.abandonSignUp();
    });

    expect(fbSignOut).toHaveBeenCalledTimes(1);
  });
});
