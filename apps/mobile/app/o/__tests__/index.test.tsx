import { render, waitFor } from '@testing-library/react-native';
import OrgDetailScreen from '../[orgId]/index';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ orgId: 'o1' }),
  useFocusEffect: (cb: () => void) => cb(),
  router: { back: jest.fn(), push: jest.fn(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../lib/auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u2' } }) }));
jest.mock('../../../lib/auth/RegisterGateContext', () => ({ useRegisterGate: () => ({ requireAuth: jest.fn() }) }));
jest.mock('../../../lib/auth/useOrgCapabilities', () => ({ useOrgCapabilities: () => ({ canManage: false }) }));
jest.mock('../../../lib/deeplink/useShareDeepLink', () => ({ useShareDeepLink: () => jest.fn() }));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getOrganization: jest.fn().mockResolvedValue({
    id: 'o1',
    name: 'Peña La Unión',
    type: 'peña',
    images: [],
    description: 'd',
    municipalityId: 'm1',
  }),
}));
jest.mock('@cultuvilla/shared/services/orgMemberService', () => ({
  isOrgMember: jest.fn().mockResolvedValue(false),
  addOrgMember: jest.fn(),
  getOrgMembers: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({ getOrgViewLink: () => 'https://x' }));
jest.mock('../../../components/feature/EntityComments', () => ({ EntityComments: () => null }));
jest.mock('@cultuvilla/shared/services/commentsService', () => ({ recordEntityView: jest.fn().mockResolvedValue(undefined) }));

describe('OrgDetailScreen', () => {
  it('labels the join FAB specifically for a peña', async () => {
    const { getByText, getByTestId } = render(<OrgDetailScreen />);
    await waitFor(() => getByText('Peña La Unión'));
    getByTestId('join-org-fab');
    getByText('organization.joinPeña');
  });
});
