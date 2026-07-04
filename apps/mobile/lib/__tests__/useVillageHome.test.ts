import { renderHook, waitFor } from '@testing-library/react-native';
import { useVillageHome } from '../useVillageHome';

jest.mock('../auth/useAuth', () => {
  // Stable reference across renders — mirrors the real AuthContext value, so the
  // hook's `reload` useCallback (deps include `user`) doesn't churn the effect.
  const value = { user: { uid: 'u1' }, profile: null, profileChecked: true };
  return { useAuth: () => value };
});
jest.mock('../firestoreErrorLog', () => ({
  withFirestoreErrorLog: (_label: string, fn: () => unknown) => fn(),
}));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipality: jest.fn(async () => ({
    id: 'm1',
    name: 'Anaya',
    province: 'Segovia',
    communityActive: true,
    community: { organizerId: null, description: null },
  })),
  getBarrios: jest.fn(async () => [{ id: 'b1', name: 'Centro', status: 'approved' }]),
  getPlaces: jest.fn(async () => []),
}));
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  isVillageAdmin: jest.fn(async () => false),
  getVillageMembers: jest.fn(async () => [{ userId: 'u1' }, { userId: 'u2' }]),
}));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getOrganizationsByMunicipality: jest.fn(async () => []),
}));
jest.mock('@cultuvilla/shared/services/orgMemberService', () => ({
  getOrgMemberCount: jest.fn(async () => 0),
}));
jest.mock('@cultuvilla/shared/services/organizerRequestService', () => ({
  getMyOrganizerRequests: jest.fn(async () => []),
}));
jest.mock('@cultuvilla/shared/services/eventService', () => ({
  getEventsByMunicipality: jest.fn(async () => []),
}));
jest.mock('@cultuvilla/shared/services/newsService', () => ({
  getHomeFeed: jest.fn(async () => []),
}));

describe('useVillageHome', () => {
  it('aggregates village data and derives isMember + peopleCount', async () => {
    const { result } = renderHook(() => useVillageHome('m1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.village?.name).toBe('Anaya');
    expect(result.current.isMember).toBe(true); // u1 is in members
    expect(result.current.peopleCount).toBe(2);
    expect(result.current.barrios).toHaveLength(1);
  });

  it('returns empty state for a null municipalityId', async () => {
    const { result } = renderHook(() => useVillageHome(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.village).toBeNull();
    expect(result.current.isMember).toBe(false);
  });
});
