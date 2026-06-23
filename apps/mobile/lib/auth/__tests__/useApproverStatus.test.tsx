import { renderHook, waitFor } from '@testing-library/react-native';
import { useApproverStatus } from '../useApproverStatus';

const mockIsAppAdmin = jest.fn();
const mockGetVillageMember = jest.fn();
const mockGetOrgMembershipsByUserInMunicipality = jest.fn();
const mockGetOrganizationsByMunicipality = jest.fn();

jest.mock('@cultuvilla/shared/services/adminService', () => ({
  isAppAdmin: (uid: string) => mockIsAppAdmin(uid),
}));
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  getVillageMember: (municipalityId: string, uid: string) =>
    mockGetVillageMember(municipalityId, uid),
}));
jest.mock('@cultuvilla/shared/services/orgMemberService', () => ({
  getOrgMembershipsByUserInMunicipality: (
    uid: string,
    municipalityId: string,
    orgIds: string[],
  ) => mockGetOrgMembershipsByUserInMunicipality(uid, municipalityId, orgIds),
}));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getOrganizationsByMunicipality: (municipalityId: string, status?: string) =>
    mockGetOrganizationsByMunicipality(municipalityId, status),
}));

const mockUseAuth = jest.fn();
jest.mock('../useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

const MUNICIPALITY_ID = 'mun1';

beforeEach(() => {
  jest.clearAllMocks();
  // Sensible defaults: regular user, no admin anywhere.
  mockUseAuth.mockReturnValue({
    user: { uid: 'u1' },
    profile: { activeMunicipalityId: MUNICIPALITY_ID },
  });
  mockIsAppAdmin.mockResolvedValue(false);
  mockGetVillageMember.mockResolvedValue({ id: 'u1', role: 'user' });
  mockGetOrganizationsByMunicipality.mockResolvedValue([]);
  mockGetOrgMembershipsByUserInMunicipality.mockResolvedValue([]);
});

describe('useApproverStatus', () => {
  it('not logged in: returns all false, not loading', async () => {
    mockUseAuth.mockReturnValue({ user: null, profile: null });
    const { result } = renderHook(() => useApproverStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toEqual({
      loading: false,
      isSuperAdmin: false,
      isVillageAdmin: false,
      adminOrgIds: [],
      canApprove: false,
    });
  });

  it('super admin: canApprove true, isSuperAdmin true', async () => {
    mockIsAppAdmin.mockResolvedValue(true);
    const { result } = renderHook(() => useApproverStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isSuperAdmin).toBe(true);
    expect(result.current.canApprove).toBe(true);
  });

  it('village admin: canApprove true, isVillageAdmin true', async () => {
    mockGetVillageMember.mockResolvedValue({ id: 'u1', role: 'admin' });
    const { result } = renderHook(() => useApproverStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isVillageAdmin).toBe(true);
    expect(result.current.canApprove).toBe(true);
  });

  it('org admin: canApprove true via adminOrgIds', async () => {
    mockGetOrganizationsByMunicipality.mockResolvedValue([{ id: 'org1' }, { id: 'org2' }]);
    mockGetOrgMembershipsByUserInMunicipality.mockResolvedValue([
      { orgId: 'org1', role: 'admin' },
    ]);
    const { result } = renderHook(() => useApproverStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.adminOrgIds).toEqual(['org1']);
    expect(result.current.canApprove).toBe(true);
    expect(result.current.isVillageAdmin).toBe(false);
    expect(result.current.isSuperAdmin).toBe(false);
  });

  it('plain member: canApprove false', async () => {
    const { result } = renderHook(() => useApproverStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canApprove).toBe(false);
    expect(result.current.adminOrgIds).toEqual([]);
  });

  it('fetch failure: treats as not-an-approver', async () => {
    mockIsAppAdmin.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useApproverStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canApprove).toBe(false);
  });
});
