import { renderHook, waitFor } from '@testing-library/react-native';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';
import { useEntityCapabilities } from '../useEntityCapabilities';
import { useAuth } from '../useAuth';
import { useIsAppAdmin } from '../useIsAppAdmin';

jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  isVillageAdmin: jest.fn(),
}));
jest.mock('../useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../useIsAppAdmin', () => ({ useIsAppAdmin: jest.fn() }));

const mockAuth = useAuth as jest.Mock;
const mockAppAdmin = useIsAppAdmin as jest.Mock;
const mockIsVillageAdmin = isVillageAdmin as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue({ user: { uid: 'alice' }, loading: false });
  mockAppAdmin.mockReturnValue({ isAppAdmin: false, loading: false });
  mockIsVillageAdmin.mockResolvedValue(false);
});

describe('useEntityCapabilities', () => {
  it('plain member: cannot manage, exposes uid', async () => {
    const { result } = renderHook(() => useEntityCapabilities('m1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(false);
    expect(result.current.canApprove).toBe(false);
    expect(result.current.uid).toBe('alice');
  });

  it('village admin: can manage and approve', async () => {
    mockIsVillageAdmin.mockResolvedValue(true);
    const { result } = renderHook(() => useEntityCapabilities('m1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(true);
    expect(result.current.canApprove).toBe(true);
  });

  it('app admin: can manage without a village-admin record', async () => {
    mockAppAdmin.mockReturnValue({ isAppAdmin: true, loading: false });
    const { result } = renderHook(() => useEntityCapabilities('m1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(true);
  });

  it('unauthenticated: resolves not-loading, cannot manage, uid null', async () => {
    mockAuth.mockReturnValue({ user: null, loading: false });
    const { result } = renderHook(() => useEntityCapabilities('m1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(false);
    expect(result.current.uid).toBeNull();
  });
});
