import { renderHook, waitFor } from '@testing-library/react-native';
import { useUnreadInboxCount } from '../useUnreadInboxCount';

const mockUseAuth = jest.fn();
jest.mock('../../auth/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseApproverStatus = jest.fn();
jest.mock('../../auth/useApproverStatus', () => ({
  useApproverStatus: () => mockUseApproverStatus(),
}));

const mockGetUnreadCount = jest.fn();
jest.mock('@cultuvilla/shared/services/notificationService', () => ({
  getUnreadCount: (uid: string) => mockGetUnreadCount(uid),
}));

const mockGetPendingOrganizerRequests = jest.fn();
jest.mock('@cultuvilla/shared/services/organizerRequestService', () => ({
  getPendingOrganizerRequests: () => mockGetPendingOrganizerRequests(),
}));

const mockGetPendingOrganizations = jest.fn();
const mockGetOrganizationsByMunicipality = jest.fn();
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getPendingOrganizations: () => mockGetPendingOrganizations(),
  getOrganizationsByMunicipality: (municipalityId: string, status?: string) =>
    mockGetOrganizationsByMunicipality(municipalityId, status),
}));

const mockGetAllPendingJoinRequests = jest.fn();
const mockGetPendingJoinRequestsForOrgs = jest.fn();
jest.mock('@cultuvilla/shared/services/organizationJoinRequestService', () => ({
  getAllPendingJoinRequests: () => mockGetAllPendingJoinRequests(),
  getPendingJoinRequestsForOrgs: (orgIds: string[]) => mockGetPendingJoinRequestsForOrgs(orgIds),
}));

const NOT_APPROVER = {
  loading: false,
  isSuperAdmin: false,
  adminVillageIds: [] as string[],
  adminOrgIds: [] as string[],
  canApprove: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { uid: 'u1' } });
  mockUseApproverStatus.mockReturnValue(NOT_APPROVER);
  mockGetUnreadCount.mockResolvedValue(0);
  mockGetPendingOrganizerRequests.mockResolvedValue([]);
  mockGetPendingOrganizations.mockResolvedValue([]);
  mockGetOrganizationsByMunicipality.mockResolvedValue([]);
  mockGetAllPendingJoinRequests.mockResolvedValue([]);
  mockGetPendingJoinRequestsForOrgs.mockResolvedValue([]);
});

describe('useUnreadInboxCount', () => {
  it('guest (no user): count is 0, no service calls', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => useUnreadInboxCount());
    await waitFor(() => expect(result.current.count).toBe(0));
    expect(mockGetUnreadCount).not.toHaveBeenCalled();
  });

  it('non-approver: count is just unread notifications', async () => {
    mockGetUnreadCount.mockResolvedValue(3);
    const { result } = renderHook(() => useUnreadInboxCount());
    await waitFor(() => expect(result.current.count).toBe(3));
    expect(mockGetPendingOrganizerRequests).not.toHaveBeenCalled();
    expect(mockGetOrganizationsByMunicipality).not.toHaveBeenCalled();
  });

  it('super admin: sums unread + all pending-actionable rows', async () => {
    mockGetUnreadCount.mockResolvedValue(2);
    mockUseApproverStatus.mockReturnValue({
      loading: false,
      isSuperAdmin: true,
      adminVillageIds: [],
      adminOrgIds: [],
      canApprove: true,
    });
    mockGetPendingOrganizerRequests.mockResolvedValue([{ id: 'o1' }]);
    mockGetPendingOrganizations.mockResolvedValue([{ id: 'org1' }, { id: 'org2' }]);
    mockGetAllPendingJoinRequests.mockResolvedValue([{ id: 'j1' }]);

    const { result } = renderHook(() => useUnreadInboxCount());
    await waitFor(() => expect(result.current.count).toBe(2 + 1 + 2 + 1));
  });

  it('village admin: sums unread + pending orgs across admin villages', async () => {
    mockGetUnreadCount.mockResolvedValue(1);
    mockUseApproverStatus.mockReturnValue({
      loading: false,
      isSuperAdmin: false,
      adminVillageIds: ['v1', 'v2'],
      adminOrgIds: [],
      canApprove: true,
    });
    mockGetOrganizationsByMunicipality.mockImplementation((vid: string) =>
      Promise.resolve(vid === 'v1' ? [{ id: 'orgA' }] : []),
    );

    const { result } = renderHook(() => useUnreadInboxCount());
    await waitFor(() => expect(result.current.count).toBe(1 + 1));
    expect(mockGetOrganizationsByMunicipality).toHaveBeenCalledWith('v1', 'pending');
    expect(mockGetOrganizationsByMunicipality).toHaveBeenCalledWith('v2', 'pending');
  });

  it('org admin: sums unread + pending join requests for admin orgs', async () => {
    mockGetUnreadCount.mockResolvedValue(0);
    mockUseApproverStatus.mockReturnValue({
      loading: false,
      isSuperAdmin: false,
      adminVillageIds: [],
      adminOrgIds: ['org1'],
      canApprove: true,
    });
    mockGetPendingJoinRequestsForOrgs.mockResolvedValue([{ id: 'j1' }, { id: 'j2' }]);

    const { result } = renderHook(() => useUnreadInboxCount());
    await waitFor(() => expect(result.current.count).toBe(2));
    expect(mockGetPendingJoinRequestsForOrgs).toHaveBeenCalledWith(['org1']);
  });

  it('service failure: falls back to count 0 rather than throwing', async () => {
    mockGetUnreadCount.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useUnreadInboxCount());
    await waitFor(() => expect(result.current.count).toBe(0));
  });
});
