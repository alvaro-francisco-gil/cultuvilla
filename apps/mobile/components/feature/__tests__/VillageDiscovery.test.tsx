import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { observability } from '@cultuvilla/shared';
import { joinVillage } from '@cultuvilla/shared/services/villageMemberService';

const mockPush = jest.fn();
const mockRefreshProfile = jest.fn().mockResolvedValue(undefined);
jest.mock('@cultuvilla/shared', () => ({
  ...jest.requireActual('@cultuvilla/shared'),
  observability: { trackEvent: jest.fn() },
}));
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
// Fixtures carry the real `searchPrefixes` shape, because the "Municipios
// activos" group is filtered by testing that array — the same predicate
// Firestore evaluates for the "Todos" query.
const mockPrefixes = (name: string): string[] => {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const out = new Set<string>();
  const push = (src: string) => {
    for (let i = 1; i <= src.length; i++) out.add(src.slice(0, i));
  };
  push(normalized);
  for (const token of normalized.split(/[^\p{L}\p{N}]+/u).filter(Boolean)) push(token);
  return [...out].sort();
};
const mockMuni = (id: string, name: string, communityActive: boolean) => ({
  id,
  name,
  province: 'Segovia',
  communityActive,
  searchPrefixes: mockPrefixes(name),
});
const mockActive = [mockMuni('m1', 'Anaya', true)];
const mockAll = [mockMuni('m1', 'Anaya', true), mockMuni('m2', 'Bernuy', false)];

jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getActiveCommunities: jest.fn(async () => mockActive),
  listMunicipalitiesPage: jest.fn(async ({ search }: { search?: string }) => {
    const key = (search ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return {
      items: key ? mockAll.filter((m) => m.searchPrefixes.includes(key)) : mockAll,
      nextCursor: null,
    };
  }),
  getBarrios: jest.fn(async () => []),
}));
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  getUserMemberships: jest.fn(async () => []),
  joinVillage: jest.fn(async () => undefined),
}));
jest.mock('../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (k: string) => k }),
}));
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, refreshProfile: mockRefreshProfile }),
}));

import { VillageDiscovery } from '../VillageDiscovery';

beforeEach(() => {
  mockPush.mockClear();
  mockRefreshProfile.mockClear();
  (observability.trackEvent as jest.Mock).mockClear();
  (joinVillage as jest.Mock).mockClear();
});

it('opens an active village detail on tap', async () => {
  const { getAllByText } = render(<VillageDiscovery />);
  await waitFor(() => expect(getAllByText('Anaya').length).toBeGreaterThan(0));
  fireEvent.press(getAllByText('Anaya')[0]!);
  expect(mockPush).toHaveBeenCalledWith(
    expect.objectContaining({ pathname: '/village/[villageId]', params: { villageId: 'm1' } }),
  );
});

it('routes a dormant municipality to the start flow', async () => {
  const { getByText } = render(<VillageDiscovery />);
  await waitFor(() => expect(getByText('Bernuy')).toBeTruthy());
  fireEvent.press(getByText('Bernuy'));
  expect(mockPush).toHaveBeenCalledWith(
    expect.objectContaining({
      pathname: '/discover/start/[municipalityId]',
      params: { municipalityId: 'm2' },
    }),
  );
});

it('fires VILLAGE_JOIN_SUCCESS after confirming a join', async () => {
  const { getByLabelText, getByText } = render(<VillageDiscovery />);
  await waitFor(() => expect(getByLabelText('discover.joinVillage')).toBeTruthy());
  fireEvent.press(getByLabelText('discover.joinVillage'));
  fireEvent.press(getByText('village.joinConfirm.confirm'));
  await waitFor(() => expect(joinVillage).toHaveBeenCalledWith('m1', 'u1', null));
  expect(observability.trackEvent).toHaveBeenCalledWith('village.join.success', { villageId: 'm1' });
});

// VillageDiscovery debounces the search by 200ms before issuing the query, and
// then re-renders on the result. RNTL's 1s default leaves almost no margin for
// that under full-suite load, which made these tests flaky.
const SEARCH_WAIT = { timeout: 5000 };

describe('search matching', () => {
  it('shows the same village in both groups for the same query', async () => {
    const { getByLabelText, getAllByText } = render(<VillageDiscovery />);
    await waitFor(() => expect(getAllByText('Anaya').length).toBe(2));
    fireEvent.changeText(getByLabelText('discover.search'), 'anaya');
    // Once in "Municipios activos", once in "Todos". The two groups used to
    // disagree: this filter was an accent-sensitive `includes` while "Todos"
    // ran an accent-stripped query in Firestore.
    await waitFor(() => expect(getAllByText('Anaya').length).toBe(2), SEARCH_WAIT);
  });

  it('matches accent-insensitively, like the Firestore query does', async () => {
    const { getByLabelText, getAllByText } = render(<VillageDiscovery />);
    await waitFor(() => expect(getAllByText('Anaya').length).toBe(2));
    fireEvent.changeText(getByLabelText('discover.search'), 'ANÁY');
    await waitFor(() => expect(getAllByText('Anaya').length).toBe(2), SEARCH_WAIT);
  });

  it('explains that only municipios are listed when nothing matches', async () => {
    const { getByLabelText, getByText, queryByText } = render(<VillageDiscovery />);
    await waitFor(() => expect(getByText('Anaya')).toBeTruthy());
    fireEvent.changeText(getByLabelText('discover.search'), 'villarino de manzanas');
    // The hint exists because Villarino de Manzanas is an entidad singular of
    // Figueruela de Arriba — no amount of searching will surface it as a row,
    // and without this the user concludes their pueblo is missing.
    await waitFor(() => expect(getByText('discover.emptyHint')).toBeTruthy(), SEARCH_WAIT);
    expect(getByText('discover.emptyHintExample')).toBeTruthy();
    expect(queryByText('Anaya')).toBeNull();
  });

  it('does not render a bare "Todos" header over an empty list', async () => {
    const { getByLabelText, getByText, queryByText } = render(<VillageDiscovery />);
    await waitFor(() => expect(getByText('discover.allGroup')).toBeTruthy());
    fireEvent.changeText(getByLabelText('discover.search'), 'zzzz');
    await waitFor(() => expect(queryByText('discover.allGroup')).toBeNull(), SEARCH_WAIT);
  });
});
