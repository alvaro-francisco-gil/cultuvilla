import { renderHook, waitFor, act } from '@testing-library/react-native';
import { getEventsByMunicipality } from '@cultuvilla/shared/services/eventService';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
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
  getBarrios: jest.fn(async () => [{ id: 'b1', name: 'Centro', status: 'active' }]),
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
jest.mock('@cultuvilla/shared/services/personService', () => ({
  getBarrioResidentCount: jest.fn(async () => 0),
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
jest.mock('@cultuvilla/shared/services/festivalPosterService', () => ({
  getFestivalPosters: jest.fn(async () => [{ id: 'p1', year: 2024, status: 'active' }]),
}));

describe('useVillageHome', () => {
  it('aggregates village data and derives isMember + peopleCount', async () => {
    const { result } = renderHook(() => useVillageHome('m1'));
    // The village doc is the only essential fetch; it clears coreLoading first.
    await waitFor(() => expect(result.current.coreLoading).toBe(false));
    expect(result.current.village?.name).toBe('Anaya');
    // The chrome + sections settle independently, so wait on each derived value.
    await waitFor(() => expect(result.current.isMember).toBe(true)); // u1 is in members
    expect(result.current.peopleCount).toBe(2);
    await waitFor(() => expect(result.current.barrios).toHaveLength(1));
    await waitFor(() => expect(result.current.festivalPosters).toHaveLength(1));
    await waitFor(() => expect(result.current.sectionStatus.events).toBe('ready'));
  });

  it('fetches published + completed events and orders upcoming before past', async () => {
    // Service returns ascending by startDate; the hook splits on the end
    // boundary and surfaces upcoming (soonest first) then past (most recent).
    const past = { id: 'ev-past', startDate: new Date('2020-01-01T10:00:00Z'), endDate: null };
    const future = { id: 'ev-future', startDate: new Date('2999-01-01T10:00:00Z'), endDate: null };
    (getEventsByMunicipality as jest.Mock).mockResolvedValueOnce([past, future]);

    const { result } = renderHook(() => useVillageHome('m1'));

    await waitFor(() => expect(result.current.sectionStatus.events).toBe('ready'));
    expect(getEventsByMunicipality).toHaveBeenCalledWith('m1', ['published', 'completed']);
    expect(result.current.events.map((e) => e.id)).toEqual(['ev-future', 'ev-past']);
  });

  it('marks a section as errored when its fetch fails, without failing the tab', async () => {
    (getEventsByMunicipality as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useVillageHome('m1'));

    await waitFor(() => expect(result.current.sectionStatus.events).toBe('error'));
    // The essential village doc still loaded — the tab is not in an error state.
    expect(result.current.coreError).toBeNull();
    expect(result.current.village?.name).toBe('Anaya');
  });

  it('keeps the loaded tab mounted while refetching the same village on focus', async () => {
    const { result } = renderHook(() => useVillageHome('m1'));
    await waitFor(() => expect(result.current.village?.name).toBe('Anaya'));
    await waitFor(() => expect(result.current.sectionStatus.events).toBe('ready'));

    // Simulate returning from a detail screen: the focus effect re-runs reload
    // while the essential village fetch is still in flight. Hold it open so we
    // can observe the in-flight state.
    let releaseCore!: () => void;
    (getMunicipality as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((res) => {
          releaseCore = () =>
            res({
              id: 'm1',
              name: 'Anaya',
              province: 'Segovia',
              communityActive: true,
              community: { organizerId: null, description: null },
            });
        }),
    );

    act(() => {
      void result.current.reload();
    });

    // A background refresh must not blank the tab: the village stays populated
    // and coreLoading stays false, so <VillageHomeBody>'s ScrollView is never
    // swapped for the spinner and the scroll position survives.
    expect(result.current.coreLoading).toBe(false);
    expect(result.current.village?.name).toBe('Anaya');
    expect(result.current.sectionStatus.events).toBe('ready');

    await act(async () => {
      releaseCore();
    });
    await waitFor(() => expect(result.current.village?.name).toBe('Anaya'));
  });

  it('returns empty state for a null municipalityId', async () => {
    const { result } = renderHook(() => useVillageHome(null));
    await waitFor(() => expect(result.current.coreLoading).toBe(false));
    expect(result.current.village).toBeNull();
    expect(result.current.isMember).toBe(false);
  });
});
