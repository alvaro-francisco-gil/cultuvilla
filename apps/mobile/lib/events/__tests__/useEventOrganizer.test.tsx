import { renderHook, waitFor } from '@testing-library/react-native';
import { isOrgMember } from '@cultuvilla/shared/services/orgMemberService';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';
import { useEventOrganizer } from '../useEventOrganizer';
import { useAuth } from '../../auth/useAuth';
import { useIsAppAdmin } from '../../auth/useIsAppAdmin';

jest.mock('@cultuvilla/shared/services/orgMemberService', () => ({ isOrgMember: jest.fn() }));
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({ isVillageAdmin: jest.fn() }));
jest.mock('../../auth/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../../auth/useIsAppAdmin', () => ({ useIsAppAdmin: jest.fn() }));

const ev = { organizationId: 'o1', municipalityId: 'm1' };
const mockAuth = useAuth as jest.Mock;
const mockApp = useIsAppAdmin as jest.Mock;
const mockOrg = isOrgMember as jest.Mock;
const mockVillage = isVillageAdmin as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue({ user: { uid: 'u1' } });
  mockApp.mockReturnValue({ isAppAdmin: false, loading: false });
  mockOrg.mockResolvedValue(false);
  mockVillage.mockResolvedValue(false);
});

describe('useEventOrganizer', () => {
  it('a member of the owning org can organize', async () => {
    mockOrg.mockResolvedValue(true);
    const { result } = renderHook(() => useEventOrganizer(ev));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canOrganize).toBe(true);
  });

  it('a village admin can organize', async () => {
    mockVillage.mockResolvedValue(true);
    const { result } = renderHook(() => useEventOrganizer(ev));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canOrganize).toBe(true);
  });

  it('an unrelated villager cannot organize', async () => {
    const { result } = renderHook(() => useEventOrganizer(ev));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canOrganize).toBe(false);
  });
});
