import { renderHook, waitFor } from '@testing-library/react-native';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';
import { useEventOrganizer } from '../useEventOrganizer';
import { useAuth } from '../../auth/useAuth';
import { useIsAppAdmin } from '../../auth/useIsAppAdmin';

jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({ isVillageAdmin: jest.fn() }));
jest.mock('../../auth/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../../auth/useIsAppAdmin', () => ({ useIsAppAdmin: jest.fn() }));

const ev = { organizerUserIds: ['u1'], municipalityId: 'm1' };
const mockAuth = useAuth as jest.Mock;
const mockApp = useIsAppAdmin as jest.Mock;
const mockVillage = isVillageAdmin as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue({ user: { uid: 'u1' } });
  mockApp.mockReturnValue({ isAppAdmin: false, loading: false });
  mockVillage.mockResolvedValue(false);
});

describe('useEventOrganizer', () => {
  it('a user in organizerUserIds can organize', async () => {
    const { result } = renderHook(() => useEventOrganizer(ev));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canOrganize).toBe(true);
  });

  it('a non-listed non-admin cannot organize', async () => {
    const { result } = renderHook(() =>
      useEventOrganizer({ organizerUserIds: ['someone-else'], municipalityId: 'm1' }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canOrganize).toBe(false);
  });

  it('a village admin can organize', async () => {
    mockVillage.mockResolvedValue(true);
    const { result } = renderHook(() =>
      useEventOrganizer({ organizerUserIds: ['someone-else'], municipalityId: 'm1' }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canOrganize).toBe(true);
  });

  it('an app admin can organize', async () => {
    mockApp.mockReturnValue({ isAppAdmin: true, loading: false });
    const { result } = renderHook(() =>
      useEventOrganizer({ organizerUserIds: [], municipalityId: 'm1' }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canOrganize).toBe(true);
  });

  it('null event returns canOrganize false', async () => {
    const { result } = renderHook(() => useEventOrganizer(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canOrganize).toBe(false);
  });
});
