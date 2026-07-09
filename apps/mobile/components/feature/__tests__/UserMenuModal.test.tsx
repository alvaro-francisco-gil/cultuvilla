import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { UserMenuModal } from '../UserMenuModal';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (key: string) => key }),
}));
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'uid-1', email: 'ana@test.com' },
    profile: { email: 'ana@test.com', displayName: 'Ana Gil' },
    signOut: jest.fn(),
  }),
}));
jest.mock('../../../lib/auth/useIsAppAdmin', () => ({
  useIsAppAdmin: () => ({ isAppAdmin: false }),
}));
jest.mock('@cultuvilla/shared/services/personService', () => ({
  getPersonByUserId: jest.fn().mockResolvedValue(null),
}));
jest.mock('@cultuvilla/shared/services/villageMemberService', () => ({
  getUserMemberships: jest.fn().mockResolvedValue([]),
}));

describe('UserMenuModal — Ajustes entry', () => {
  beforeEach(() => jest.clearAllMocks());

  it('navigates to /settings when tapping Ajustes', async () => {
    const { getByText } = render(<UserMenuModal visible onClose={jest.fn()} />);
    fireEvent.press(getByText('menu.settings'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/settings'));
  });
});
