import { render, waitFor } from '@testing-library/react-native';
import FestivalPosterDetailScreen from '../[posterId]';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1', posterId: 'p1' }),
  useFocusEffect: (cb: () => void) => cb(),
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('../../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: () => ({ canManage: false, canApprove: false, uid: null, loading: false }),
}));
jest.mock('@cultuvilla/shared/services/festivalPosterService', () => ({
  getFestivalPoster: jest.fn().mockResolvedValue({ id: 'p1', title: 'Fiestas 2026', year: 2026, images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'], startsAt: null, endsAt: null }),
}));
jest.mock('@cultuvilla/shared/utils', () => ({ formatFestivalPosterDates: () => 'del 1 al 5' }));
// NaturalImage reads Image.getSize (unmocked under jest-expo); the screen test
// only asserts the title, so stub it to a plain view.
jest.mock('../../../../../components/primitives/NaturalImage', () => ({ NaturalImage: () => null }));

describe('FestivalPosterDetailScreen', () => {
  it('renders the poster title once loaded', async () => {
    const { getByText } = render(<FestivalPosterDetailScreen />);
    await waitFor(() => getByText('Fiestas 2026'));
  });
});
