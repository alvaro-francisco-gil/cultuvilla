import { renderHook, waitFor } from '@testing-library/react-native';
import { useOwnerSummary } from '../useOwnerSummary';
import { useFirestoreDoc } from '@cultuvilla/shared/hooks';
import { DELETED_USER_UID } from '@cultuvilla/shared/models/user';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';

jest.mock('../i18n', () => ({
  useT: () => ({ locale: 'es', t: (key: string) => (key === 'settings.deletedUser' ? 'Usuario eliminado' : key) }),
}));

// useOwnerSummary passes the signed-in viewer to getPersonByUserId so a caller's
// own private persona still resolves; the hook now requires an auth context.
jest.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'viewer-9' } }),
}));

jest.mock('@cultuvilla/shared/hooks', () => ({
  useFirestoreDoc: jest.fn(),
}));

jest.mock('@cultuvilla/shared/firebase', () => ({
  getDb: jest.fn(),
}));

jest.mock('@cultuvilla/shared/firebase/refs/client', () => ({
  userDoc: jest.fn(),
  personDoc: jest.fn(),
  organizationDoc: jest.fn(),
}));

jest.mock('@cultuvilla/shared/services/personService', () => ({
  getPersonByUserId: jest.fn().mockResolvedValue(null),
}));

const mockUseFirestoreDoc = useFirestoreDoc as jest.Mock;

describe('useOwnerSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFirestoreDoc.mockReturnValue({ data: undefined, loading: false, error: null });
  });

  it('short-circuits the deleted-user sentinel to the localized label with no avatar', () => {
    const { result } = renderHook(() => useOwnerSummary(DELETED_USER_UID, 'user'));

    expect(result.current).toEqual({
      name: 'Usuario eliminado',
      imageUri: null,
      loading: false,
    });
    // Never subscribes to the (nonexistent) users/deleted-user doc.
    expect(mockUseFirestoreDoc).toHaveBeenCalledWith(null);
  });

  it('resolves a real user doc through the normal path', () => {
    mockUseFirestoreDoc.mockReturnValue({
      data: { displayName: 'Ana García', photoURL: 'https://img/ana.jpg' },
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useOwnerSummary('user-1', 'user'));

    expect(result.current.name).toBe('Ana García');
    expect(result.current.imageUri).toBe('https://img/ana.jpg');
  });

  it('passes the signed-in viewer to the persona lookup', async () => {
    mockUseFirestoreDoc.mockReturnValue({
      data: { displayName: 'Ana García', photoURL: null },
      loading: false,
      error: null,
    });

    renderHook(() => useOwnerSummary('user-1', 'user'));

    // Without the viewer the rules reject the query outright for a private
    // persona, which is what emptied the pickers.
    await waitFor(() => {
      expect(getPersonByUserId).toHaveBeenCalledWith('user-1', 'viewer-9');
    });
  });
});
