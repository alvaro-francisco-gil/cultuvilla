import { renderHook, waitFor } from '@testing-library/react-native';
import { useIsAppAdmin } from '../useIsAppAdmin';

const mockIsAppAdmin = jest.fn();
jest.mock('@cultuvilla/shared/services/adminService', () => ({
  isAppAdmin: (uid: string) => mockIsAppAdmin(uid),
}));

const mockUseAuth = jest.fn();
jest.mock('../useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('useIsAppAdmin', () => {
  beforeEach(() => {
    mockIsAppAdmin.mockReset();
    mockUseAuth.mockReset();
  });

  it('returns loading when there is no user yet', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => useIsAppAdmin());
    expect(result.current).toEqual({ isAppAdmin: false, loading: true });
  });

  it('resolves true when the service says so', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' } });
    mockIsAppAdmin.mockResolvedValue(true);
    const { result } = renderHook(() => useIsAppAdmin());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAppAdmin).toBe(true);
    expect(mockIsAppAdmin).toHaveBeenCalledWith('u1');
  });

  it('resolves false when the service says so', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u2' } });
    mockIsAppAdmin.mockResolvedValue(false);
    const { result } = renderHook(() => useIsAppAdmin());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAppAdmin).toBe(false);
  });
});
