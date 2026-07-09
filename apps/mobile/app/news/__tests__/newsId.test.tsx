import { render, waitFor, fireEvent } from '@testing-library/react-native';
import NewsDetailScreen from '../[newsId]';
import { hideContent } from '@cultuvilla/shared/services/moderationService';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';

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
jest.mock('../../../lib/auth/useEntityCapabilities', () => ({ useEntityCapabilities: jest.fn() }));
jest.mock('../../../lib/deeplink/useShareDeepLink', () => ({ useShareDeepLink: () => jest.fn() }));
// showConfirm auto-accepts so we can assert hideContent fires on confirm.
jest.mock('../../../lib/dialogs', () => ({
  showConfirm: (_title: string, _message: string, onConfirm: () => void) => onConfirm(),
}));
jest.mock('../../../components/feature/NewsContentRenderer', () => ({ NewsContentRenderer: () => null }));
jest.mock('../../../components/feature/LiveOwnerChip', () => ({ LiveOwnerChip: () => null }));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({ getNewsLink: () => 'https://x' }));
jest.mock('@cultuvilla/shared/services/newsService', () => ({
  getNewsPost: jest.fn().mockResolvedValue({
    id: 'n1', title: 'Gran noticia', category: 'general', municipalityId: 'm1',
    images: [], coverImage: null, content: null, body: '', organizerOrgIds: [], organizerUserIds: [],
    createdBy: 'u9', publishedAt: null, createdAt: null, status: 'active',
  }),
}));
jest.mock('@cultuvilla/shared/services/moderationService', () => ({
  hideContent: jest.fn().mockResolvedValue(undefined),
  unhideContent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({ newsImageDownloadURL: jest.fn() }));
jest.mock('@cultuvilla/shared/utils', () => ({ formatDate: () => '' }));

const mockCaps = useEntityCapabilities as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockCaps.mockReturnValue({ canManage: false, canApprove: false, uid: null, loading: false });
});

describe('NewsDetailScreen', () => {
  it('renders the post title once loaded', async () => {
    const { getByText } = render(<NewsDetailScreen />);
    await waitFor(() => getByText('Gran noticia'));
  });

  it('a village admin sees a hide action that calls hideContent when confirmed', async () => {
    mockCaps.mockReturnValue({ canManage: true, canApprove: true, uid: 'admin1', loading: false });
    const { getByLabelText } = render(<NewsDetailScreen />);
    const hideButton = await waitFor(() => getByLabelText('news.moderation.hide'));
    fireEvent.press(hideButton);
    await waitFor(() =>
      expect(hideContent).toHaveBeenCalledWith({ collection: 'news', docId: 'n1' }),
    );
  });

  it('a non-admin does not see the hide action', async () => {
    const { getByText, queryByLabelText } = render(<NewsDetailScreen />);
    await waitFor(() => getByText('Gran noticia'));
    expect(queryByLabelText('news.moderation.hide')).toBeNull();
  });
});
