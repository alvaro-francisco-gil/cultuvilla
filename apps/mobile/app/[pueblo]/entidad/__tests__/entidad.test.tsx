import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { getOrganization } from '@cultuvilla/shared/services/organizationService';
import { addOrgMember } from '@cultuvilla/shared/services/orgMemberService';
import {
  hasPendingOrgJoinRequest,
  requestToJoinOrganization,
} from '@cultuvilla/shared/services/orgJoinRequestService';
import OrgDetailScreen from '../[entidad]/index';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ pueblo: 'villa', entidad: 'pena-la-union_o1' }),
  useFocusEffect: (cb: () => void) => cb(),
  router: { back: jest.fn(), push: jest.fn(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../../lib/auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u2' } }) }));
jest.mock('../../../../lib/auth/RegisterGateContext', () => ({ useRegisterGate: () => ({ requireAuth: jest.fn() }) }));
jest.mock('../../../../lib/auth/useOrgCapabilities', () => ({ useOrgCapabilities: () => ({ canManage: false }) }));
jest.mock('../../../../lib/deeplink/useShareDeepLink', () => ({ useShareDeepLink: () => jest.fn() }));
jest.mock('@cultuvilla/shared/services/organizationService', () => ({
  getOrganization: jest.fn().mockResolvedValue({
    id: 'o1',
    name: 'Peña La Unión',
    type: 'peña',
    images: [],
    description: 'd',
    municipalityId: 'm1',
    villageSlug: 'villa',
  }),
}));
jest.mock('@cultuvilla/shared/services/orgMemberService', () => ({
  isOrgMember: jest.fn().mockResolvedValue(false),
  addOrgMember: jest.fn(),
  getOrgMembers: jest.fn().mockResolvedValue([]),
  getUserOrgIds: jest.fn().mockResolvedValue([]),
}));
jest.mock('@cultuvilla/shared/services/orgJoinRequestService', () => ({
  hasPendingOrgJoinRequest: jest.fn().mockResolvedValue(false),
  requestToJoinOrganization: jest.fn().mockResolvedValue(undefined),
  cancelOrgJoinRequest: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../../components/feature/OrgJoinRequests', () => ({ OrgJoinRequests: () => null }));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({
  getOrgViewLink: () => ({
    url: 'https://x/villa/entidad/pena-la-union_o1',
    path: '/villa/entidad/pena-la-union_o1',
    kind: 'content',
    resource: 'organization',
  }),
}));
jest.mock('../../../../components/feature/EntityComments', () => ({ EntityComments: () => null }));
jest.mock('@cultuvilla/shared/services/commentsService', () => ({ recordEntityView: jest.fn().mockResolvedValue(undefined) }));

describe('OrgDetailScreen', () => {
  it('labels the join FAB specifically for a peña', async () => {
    const { getByText, getByTestId } = render(<OrgDetailScreen />);
    await waitFor(() => getByText('Peña La Unión'));
    getByTestId('join-org-fab');
    getByText('organization.joinPeña');
  });
});

describe('OrgDetailScreen — join policy', () => {
  const approvalOrg = {
    id: 'o1',
    name: 'Peña La Unión',
    type: 'peña',
    images: [],
    description: 'd',
    municipalityId: 'm1',
    villageSlug: 'villa',
    joinPolicy: 'approval',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (hasPendingOrgJoinRequest as jest.Mock).mockResolvedValue(false);
  });

  it('asks to join an approval org instead of joining it', async () => {
    (getOrganization as jest.Mock).mockResolvedValue(approvalOrg);
    const { getByText, getByTestId } = render(<OrgDetailScreen />);
    await waitFor(() => getByText('organization.requestToJoin'));

    fireEvent.press(getByTestId('join-org-fab'));

    await waitFor(() => expect(requestToJoinOrganization).toHaveBeenCalledWith('o1', 'm1', 'u2'));
    expect(addOrgMember).not.toHaveBeenCalled();
  });

  it('shows a request already sent as pending', async () => {
    (getOrganization as jest.Mock).mockResolvedValue(approvalOrg);
    (hasPendingOrgJoinRequest as jest.Mock).mockResolvedValue(true);
    const { getByText } = render(<OrgDetailScreen />);
    await waitFor(() => getByText('organization.requestPending'));
  });
});
