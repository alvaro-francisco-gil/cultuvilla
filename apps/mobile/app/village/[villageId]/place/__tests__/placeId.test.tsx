import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import PlaceDetailScreen, { sortBuriedByDeathDate } from '../[placeId]';
import { getPlace } from '@cultuvilla/shared/services/municipalityService';
import { getPersonsByBurialPlace, updatePerson } from '@cultuvilla/shared/services/personService';
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
jest.mock('@cultuvilla/shared/services/personService', () => ({
  getPersonsByBurialPlace: jest.fn().mockResolvedValue([]),
  updatePerson: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../../../components/feature/EntityComments', () => ({ EntityComments: () => null }));
jest.mock('../../../../../components/feature/BuryFab', () => ({ BuryFab: () => null }));
jest.mock('@cultuvilla/shared/services/commentsService', () => ({ recordEntityView: jest.fn().mockResolvedValue(undefined) }));

describe('PlaceDetailScreen', () => {
  beforeEach(() => {
    jest.mocked(getPlace).mockReset();
    jest.mocked(getPersonsByBurialPlace).mockReset();
    jest.mocked(updatePerson).mockClear();
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

  it('sorts buried people by death date, most recent first and unknown last', () => {
    const people = [
      { ...buildPersonData({ givenName: 'Unknown', createdBy: 'u1' }), id: 'unknown' },
      {
        ...buildPersonData({
          givenName: 'Old',
          createdBy: 'u1',
          deathDate: { year: 1990, month: null, day: null },
        }),
        id: 'old',
      },
      {
        ...buildPersonData({
          givenName: 'Recent',
          createdBy: 'u1',
          deathDate: { year: 2020, month: 5, day: 3 },
        }),
        id: 'recent',
      },
    ];

    expect(sortBuriedByDeathDate(people).map((p) => p.id)).toEqual(['recent', 'old', 'unknown']);
  });

  it('renders cemetery difuntos as a date-sorted list and opens the burial editor instead of routing', async () => {
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
          givenName: 'Antigua',
          firstSurname: 'Sin Fecha',
          createdBy: 'u1',
          burialPlace: { municipalityId: 'm1', placeId: 'pl1' },
        }),
        id: 'p-old',
      },
      {
        ...buildPersonData({
          givenName: 'Reciente',
          firstSurname: 'Con Fecha',
          createdBy: 'u1',
          deathDate: { year: 2020, month: 5, day: 3 },
          burialPlace: { municipalityId: 'm1', placeId: 'pl1' },
        }),
        id: 'p-recent',
      },
    ]);

    const { getByTestId, queryByText } = render(<PlaceDetailScreen />);

    await waitFor(() => getByTestId('buried-person-row-p-recent'));
    expect(getByTestId('buried-person-date-p-recent')).toHaveTextContent('03/05/2020');
    expect(getByTestId('buried-person-date-p-old')).toHaveTextContent('village.placeDetail.deathDateUnknown');

    fireEvent.press(getByTestId('buried-person-row-p-recent'));

    expect(getByTestId('buried-edit-person-name')).toHaveTextContent('Reciente Con Fecha');
    expect(queryByText('village.placeDetail.editBurialTitle')).toBeNull();
    expect(router.push).not.toHaveBeenCalledWith('/person/p-recent');
  });

  it('updates or removes the selected cemetery burial from the editor modal', async () => {
    jest.mocked(getPlace).mockResolvedValue({
      ...buildPlaceData({
        name: 'Cementerio',
        kind: 'cemetery',
        municipalityId: 'm1',
      }),
      id: 'pl1',
    });
    jest.mocked(getPersonsByBurialPlace).mockResolvedValue([
      {
        ...buildPersonData({
          givenName: 'Ada',
          firstSurname: 'Lovelace',
          createdBy: 'u1',
          deathDate: { year: 2020, month: null, day: null },
          burialPlace: { municipalityId: 'm1', placeId: 'pl1' },
        }),
        id: 'p1',
      },
    ]);

    const { getByTestId } = render(<PlaceDetailScreen />);

    fireEvent.press(await waitFor(() => getByTestId('buried-person-row-p1')));
    fireEvent.press(getByTestId('buried-save-date'));

    await waitFor(() =>
      expect(updatePerson).toHaveBeenCalledWith('p1', { deathDate: { year: 2020, month: null, day: null } }),
    );

    fireEvent.press(getByTestId('buried-person-row-p1'));
    fireEvent.press(getByTestId('buried-remove'));

    await waitFor(() => expect(updatePerson).toHaveBeenCalledWith('p1', { burialPlace: null }));
  });
});
