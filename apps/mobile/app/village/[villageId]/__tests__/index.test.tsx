import { render } from '@testing-library/react-native';

// The body is exercised in its own suite; here we only verify the screen wires
// the village name into the header and renders the body.
jest.mock('../../../../lib/useVillageHome', () => ({
  useVillageHome: () => ({
    loading: false,
    loadError: null,
    village: {
      id: 'm1',
      name: 'Anaya',
      province: 'Segovia',
      communityActive: true,
      community: { organizerId: null },
    },
    villageAdmin: false,
    isMember: true,
    barrios: [],
    places: [],
    organizations: [],
    orgMemberCounts: {},
    events: [],
    peopleCount: 1,
    pendingOrganizerRequest: false,
    reload: jest.fn(),
  }),
}));
jest.mock('../../../../components/feature/VillageHomeBody', () => ({
  VillageHomeBody: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1' }),
  router: { push: jest.fn(), back: jest.fn() },
}));
jest.mock('../../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (k: string) => k }),
}));

import VillageHome from '../index';

it('renders the village name in the header', () => {
  const { getByText } = render(<VillageHome />);
  expect(getByText('Anaya')).toBeTruthy();
});
