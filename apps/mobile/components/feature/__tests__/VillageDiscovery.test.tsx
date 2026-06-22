import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
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
}));
jest.mock('../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (k: string) => k }),
}));

import { VillageDiscovery } from '../VillageDiscovery';

beforeEach(() => mockPush.mockClear());

it('opens an active village detail on tap', async () => {
  const { getAllByText } = render(<VillageDiscovery />);
  await waitFor(() => expect(getAllByText('Anaya').length).toBeGreaterThan(0));
  fireEvent.press(getAllByText('Anaya')[0]);
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
