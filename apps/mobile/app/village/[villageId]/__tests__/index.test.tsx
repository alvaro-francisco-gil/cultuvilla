import { render } from '@testing-library/react-native';

// The body is exercised in its own suite; here we only verify the screen wires
// the village name into the header (signed-in) and redirects guests into the
// tab shell.
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

const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1' }),
  router: { push: jest.fn(), back: jest.fn() },
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
}));
jest.mock('../../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (k: string) => k }),
}));

const mockUseAuth = jest.fn();
jest.mock('../../../../lib/auth/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));
const mockActivate = jest.fn();
jest.mock('../../../../lib/village/GuestActiveVillageContext', () => ({
  useGuestActiveVillage: () => ({ guestVillageId: null, activate: mockActivate }),
}));

import VillageHome from '../index';

beforeEach(() => {
  jest.clearAllMocks();
});

it('renders the village name in the header for a signed-in viewer', () => {
  mockUseAuth.mockReturnValue({ user: { uid: 'uid-1' } });
  const { getByText } = render(<VillageHome />);
  expect(getByText('Anaya')).toBeTruthy();
  expect(mockRedirect).not.toHaveBeenCalled();
});

it('activates the shared village and redirects a guest into the tab shell', () => {
  mockUseAuth.mockReturnValue({ user: null });
  render(<VillageHome />);
  expect(mockActivate).toHaveBeenCalledWith('m1');
  expect(mockRedirect).toHaveBeenCalledWith('/(tabs)/village');
});
