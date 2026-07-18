import { render, waitFor } from '@testing-library/react-native';
import PlaceDetailScreen from '../[placeId]';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1', placeId: 'pl1' }),
  useFocusEffect: (cb: () => void) => cb(),
  router: { back: jest.fn(), push: jest.fn(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('../../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../../../lib/deeplink/useShareDeepLink', () => ({ useShareDeepLink: () => jest.fn() }));
jest.mock('../../../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: () => ({ canManage: false, uid: 'u1', loading: false }),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getPlace: jest.fn().mockResolvedValue({ id: 'pl1', name: 'La Plaza', kind: 'square', images: [], description: 'desc' }),
}));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({ getPlaceViewLink: () => 'https://x' }));
jest.mock('@cultuvilla/shared/services/personService', () => ({ getPersonsByBurialPlace: jest.fn().mockResolvedValue([]) }));
jest.mock('@cultuvilla/shared/models/person', () => ({ buildDisplayName: () => 'N' }));
jest.mock('../../../../../components/feature/EntityComments', () => ({ EntityComments: () => null }));
jest.mock('@cultuvilla/shared/services/commentsService', () => ({ recordEntityView: jest.fn().mockResolvedValue(undefined) }));

describe('PlaceDetailScreen', () => {
  it('renders the place name and a share action', async () => {
    const { getByText, getByLabelText } = render(<PlaceDetailScreen />);
    await waitFor(() => getByText('La Plaza'));
    getByLabelText('deeplink.shareViewLabel');
  });
});
