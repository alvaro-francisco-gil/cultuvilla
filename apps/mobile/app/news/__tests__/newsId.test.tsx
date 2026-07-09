import { render, waitFor } from '@testing-library/react-native';
import NewsDetailScreen from '../[newsId]';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ newsId: 'n1' }),
  router: { back: jest.fn(), push: jest.fn(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../lib/auth/useAuth', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../../../lib/deeplink/useShareDeepLink', () => ({ useShareDeepLink: () => jest.fn() }));
jest.mock('../../../components/feature/NewsContentRenderer', () => ({ NewsContentRenderer: () => null }));
jest.mock('../../../components/feature/LiveOwnerChip', () => ({ LiveOwnerChip: () => null }));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({ getNewsLink: () => 'https://x' }));
jest.mock('@cultuvilla/shared/services/newsService', () => ({
  getNewsPost: jest.fn().mockResolvedValue({
    id: 'n1', title: 'Gran noticia', category: 'general', municipalityId: 'm1',
    images: [], coverImage: null, content: null, body: '', organizerOrgIds: [], organizerUserIds: [],
    createdBy: 'u9', publishedAt: null, submittedAt: null,
  }),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({ newsImageDownloadURL: jest.fn() }));
jest.mock('@cultuvilla/shared/utils', () => ({ formatDate: () => '' }));

describe('NewsDetailScreen', () => {
  it('renders the post title once loaded', async () => {
    const { getByText } = render(<NewsDetailScreen />);
    await waitFor(() => getByText('Gran noticia'));
  });
});
