import { render, waitFor } from '@testing-library/react-native';
import BarrioDetailScreen from '../[barrioId]';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1', barrioId: 'b1' }),
  useFocusEffect: (cb: () => void) => cb(),
  router: { back: jest.fn(), push: jest.fn(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('../../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../../../lib/deeplink/useShareDeepLink', () => ({ useShareDeepLink: () => jest.fn() }));
jest.mock('../../../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: () => ({ canManage: false, uid: 'u1', loading: false }),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getBarrio: jest.fn().mockResolvedValue({ id: 'b1', name: 'Centro', imageURL: null, municipalityId: 'm1' }),
}));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({ getBarrioViewLink: () => 'https://x' }));
jest.mock('@cultuvilla/shared/services/personService', () => ({ getPersonsByBarrio: jest.fn().mockResolvedValue([]) }));
jest.mock('@cultuvilla/shared/models/person', () => ({ buildDisplayName: () => 'N' }));

describe('BarrioDetailScreen', () => {
  it('renders the barrio name once loaded', async () => {
    const { getByText } = render(<BarrioDetailScreen />);
    await waitFor(() => getByText('Centro'));
  });
});
