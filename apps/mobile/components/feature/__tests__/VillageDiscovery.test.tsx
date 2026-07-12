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
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getActiveCommunities: jest.fn(async () => [
    { id: 'm1', name: 'Anaya', province: 'Segovia', communityActive: true },
  ]),
  listMunicipalitiesPage: jest.fn(async () => ({
    items: [
      { id: 'm1', name: 'Anaya', province: 'Segovia', communityActive: true },
      { id: 'm2', name: 'Bernuy', province: 'Segovia', communityActive: false },
    ],
    nextCursor: null,
  })),
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
