import { renderHook, waitFor } from '@testing-library/react-native';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';
import { isOrgAdmin } from '@cultuvilla/shared/services/orgMemberService';
import { useOrgCapabilities } from '../useOrgCapabilities';
import { useAuth } from '../useAuth';
import { useIsAppAdmin } from '../useIsAppAdmin';

jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  isVillageAdmin: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/orgMemberService', () => ({
  isOrgAdmin: jest.fn(),
}));
jest.mock('../useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../useIsAppAdmin', () => ({ useIsAppAdmin: jest.fn() }));

const mockAuth = useAuth as jest.Mock;
const mockAppAdmin = useIsAppAdmin as jest.Mock;
const mockIsVillageAdmin = isVillageAdmin as jest.Mock;
const mockIsOrgAdmin = isOrgAdmin as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue({ user: { uid: 'alice' }, loading: false });
  mockAppAdmin.mockReturnValue({ isAppAdmin: false, loading: false });
  mockIsVillageAdmin.mockResolvedValue(false);
  mockIsOrgAdmin.mockResolvedValue(false);
});

describe('useOrgCapabilities', () => {
  it('plain member: cannot manage', async () => {
    const { result } = renderHook(() => useOrgCapabilities('org1', 'm1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(false);
    expect(result.current.uid).toBe('alice');
  });

  it('org admin: can manage', async () => {
    mockIsOrgAdmin.mockResolvedValue(true);
    const { result } = renderHook(() => useOrgCapabilities('org1', 'm1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(true);
  });

  it('village admin: can manage', async () => {
    mockIsVillageAdmin.mockResolvedValue(true);
    const { result } = renderHook(() => useOrgCapabilities('org1', 'm1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(true);
  });

  it('app admin: can manage', async () => {
    mockAppAdmin.mockReturnValue({ isAppAdmin: true, loading: false });
    const { result } = renderHook(() => useOrgCapabilities('org1', 'm1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(true);
  });

  it('municipalityId undefined: resolves, org-admin axis still applies', async () => {
    mockIsOrgAdmin.mockResolvedValue(true);
    const { result } = renderHook(() => useOrgCapabilities('org1', undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(true);
    expect(mockIsVillageAdmin).not.toHaveBeenCalled();
  });

  it('unauthenticated: cannot manage, uid null', async () => {
    mockAuth.mockReturnValue({ user: null, loading: false });
    const { result } = renderHook(() => useOrgCapabilities('org1', 'm1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(false);
    expect(result.current.uid).toBeNull();
  });
});
