import { render, waitFor } from '@testing-library/react-native';
import PlaceDetailScreen from '../[placeId]';
import { getPlace } from '@cultuvilla/shared/services/municipalityService';
import { getPersonsByBurialPlace } from '@cultuvilla/shared/services/personService';
import { buildPlaceData } from '@cultuvilla/shared/models/municipality';
import { buildPersonData } from '@cultuvilla/shared/models/person';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1', placeId: 'pl1' }),
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => cb(), [cb]);
  },
  router: { back: jest.fn(), push: jest.fn(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('../../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../../../lib/deeplink/useShareDeepLink', () => ({ useShareDeepLink: () => jest.fn() }));
jest.mock('../../../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: () => ({ canManage: false, uid: 'u1', loading: false }),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getPlace: jest.fn().mockResolvedValue({ id: 'pl1', name: 'La Plaza', kind: 'plaza', images: [], description: 'desc' }),
}));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({ getPlaceViewLink: () => 'https://x' }));
jest.mock('@cultuvilla/shared/services/personService', () => ({ getPersonsByBurialPlace: jest.fn().mockResolvedValue([]) }));
jest.mock('@cultuvilla/shared/models/person', () => ({
  ...jest.requireActual('@cultuvilla/shared/models/person'),
  buildDisplayName: () => 'N',
}));
jest.mock('../../../../../components/feature/EntityComments', () => ({ EntityComments: () => null }));
jest.mock('../../../../../components/feature/BuryFab', () => ({ BuryFab: () => null }));
jest.mock('../../../../../components/feature/LivePersonChip', () => ({
  LivePersonChip: ({ personId, fallbackName }: { personId: string; fallbackName?: string }) => {
    const { Text, View } = require('react-native');
    return (
      <View testID={`buried-person-chip-${personId}`}>
        <Text>{fallbackName}</Text>
      </View>
    );
  },
}));
jest.mock('../../../../../components/feature/VillageSections', () => ({
  PersonCard: ({ name }: { name: string }) => {
    const { Text, View } = require('react-native');
    return (
      <View testID="buried-person-card">
        <Text>{name}</Text>
      </View>
    );
  },
}));
jest.mock('@cultuvilla/shared/services/commentsService', () => ({ recordEntityView: jest.fn().mockResolvedValue(undefined) }));

describe('PlaceDetailScreen', () => {
  beforeEach(() => {
    jest.mocked(getPlace).mockReset();
    jest.mocked(getPersonsByBurialPlace).mockReset();
    jest.mocked(getPlace).mockResolvedValue({
      ...buildPlaceData({
        name: 'La Plaza',
        kind: 'plaza',
        municipalityId: 'm1',
        description: 'desc',
      }),
      id: 'pl1',
    });
    jest.mocked(getPersonsByBurialPlace).mockResolvedValue([]);
  });

  it('renders the place name and a share action', async () => {
    const { getByText, getByLabelText } = render(<PlaceDetailScreen />);
    await waitFor(() => getByText('La Plaza'));
    getByLabelText('deeplink.shareViewLabel');
  });

  it('renders cemetery difuntos as barrio-style person chips', async () => {
    jest.mocked(getPlace).mockResolvedValueOnce({
      ...buildPlaceData({
        name: 'Cementerio',
        kind: 'cemetery',
        municipalityId: 'm1',
      }),
      id: 'pl1',
    });
    jest.mocked(getPersonsByBurialPlace).mockResolvedValueOnce([
      {
        ...buildPersonData({
          givenName: 'Ada',
          firstSurname: 'Lovelace',
          createdBy: 'u1',
          burialPlace: { municipalityId: 'm1', placeId: 'pl1' },
        }),
        id: 'p1',
      },
    ]);

    const { getByTestId, queryByTestId } = render(<PlaceDetailScreen />);

    await waitFor(() => getByTestId('buried-person-chip-p1'));
    expect(queryByTestId('buried-person-card')).toBeNull();
  });
});
