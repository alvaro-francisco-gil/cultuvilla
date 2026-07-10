import { fireEvent, render, waitFor } from '@testing-library/react-native';
import EventDetailScreen from '../[eventId]';

const mockPush = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ eventId: 'e1' }),
  router: {
    back: jest.fn(),
    push: (...args: unknown[]) => mockPush(...args),
    canGoBack: () => true,
    replace: jest.fn(),
  },
}));
jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../lib/auth/useAuth', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../../../lib/auth/RegisterGateContext', () => ({ useRegisterGate: () => ({ requireAuth: jest.fn() }) }));
jest.mock('../../../lib/deeplink/useShareDeepLink', () => ({ useShareDeepLink: () => jest.fn() }));
jest.mock('../../../lib/events/useEventOrganizer', () => ({ useEventOrganizer: () => ({ canOrganize: false }) }));
jest.mock('../../../components/feature/LiveOwnerChip', () => ({ LiveOwnerChip: () => null }));
jest.mock('../../../components/feature/RegisterFab', () => ({ RegisterFab: () => null }));
jest.mock('../../../components/feature/EntityComments', () => ({ EntityComments: () => null }));
jest.mock('../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: () => ({ canManage: false, canApprove: false, uid: null, loading: false }),
}));
jest.mock('@cultuvilla/shared/services/eventService', () => ({
  getEvent: jest.fn().mockResolvedValue({
    id: 'e1', title: 'Verbena', startDate: new Date('2026-07-12T20:00:00Z'), endDate: null,
    description: 'baile', imageURL: null, villageCoverImage: null, location: null,
    organizerUserIds: [], organizerOrgIds: [], telephoneRequired: false,
    municipalityId: 'm1', villageName: 'Villapueblo',
  }),
}));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({ getEventLink: () => 'https://x' }));
jest.mock('@cultuvilla/shared/services/personService', () => ({ getPersonByUserId: jest.fn().mockResolvedValue(null) }));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getMunicipality: jest.fn().mockResolvedValue({
    id: 'm1', name: 'Villapueblo', escudoUrl: null, escudoThumbUrl: null, escudoManualUrl: null,
  }),
}));
jest.mock('@cultuvilla/shared/models/person/PersonDataModel', () => ({ buildDisplayName: () => 'N' }));
jest.mock('@cultuvilla/shared/utils', () => ({ formatDate: () => '12 jul', buildGoogleCalendarUrl: () => 'https://cal' }));

describe('EventDetailScreen', () => {
  beforeEach(() => mockPush.mockClear());

  it('renders the event title and the guest CTA', async () => {
    const { getByText } = render(<EventDetailScreen />);
    await waitFor(() => getByText('Verbena'));
    getByText('guest.eventCta');
  });

  it('renders the Pueblo section and navigates to the village on press', async () => {
    const { getByLabelText, getByText } = render(<EventDetailScreen />);
    await waitFor(() => getByText('event.villageLabel'));
    getByText('Villapueblo');

    fireEvent.press(getByLabelText('Villapueblo'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/village/[villageId]',
      params: { villageId: 'm1' },
    });
  });
});
