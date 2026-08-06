// The news edit route had no authority guard at all: anyone who deep-linked to
// /news/new?newsId=… got the compose form (their save then bounced off the
// Firestore rules). It now redirects like every other entity's edit screen.
import { render, waitFor } from '@testing-library/react-native';
import NewNewsScreen from '../new';

const mockRedirect = jest.fn((_props: { href: string }) => null);
jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'intruder' }, profile: { activeMunicipalityId: 'm-1' } }),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ newsId: 'n1' }),
  Redirect: (props: { href: string }) => mockRedirect(props),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/newsService', () => ({
  createNewsPost: jest.fn(),
  updateNewsPost: jest.fn(),
  deleteNewsPost: jest.fn(),
  getNewsPost: jest.fn().mockResolvedValue({
    id: 'n1',
    title: 'Gran noticia',
    category: 'general',
    municipalityId: 'm-1',
    images: [],
    coverImage: null,
    content: null,
    body: '',
    organizerUserIds: ['author'],
    organizerOrgIds: [],
    createdBy: 'author',
    publishedAt: null,
    createdAt: null,
    status: 'active',
  }),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({
  uploadNewsImage: jest.fn(),
  newsImageDownloadURL: jest.fn(),
}));
jest.mock('../../../lib/images', () => ({ pickImageWithSize: jest.fn() }));
jest.mock('../../../lib/useMentionSources', () => ({
  useMentionSources: () => ({ candidates: [], loading: false }),
}));
jest.mock('../../../components/feature/OrganizerPicker', () => ({ OrganizerPicker: () => null }));

import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';

function mockCaps(canEdit: boolean) {
  const spy = jest.fn(() => canEdit);
  (useEntityCapabilities as jest.Mock).mockReturnValue({
    canManage: false,
    canApprove: false,
    uid: 'intruder',
    loading: false,
    canEdit: spy,
    canDelete: jest.fn(() => canEdit),
  });
  return spy;
}

beforeEach(() => jest.clearAllMocks());

describe('NewNewsScreen edit guard', () => {
  it('redirects to the article when the viewer may not edit it', async () => {
    const canEdit = mockCaps(false);
    render(<NewNewsScreen />);
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith({ href: '/news/n1' }));
    expect(canEdit).toHaveBeenCalledWith('author', ['author']);
  });

  it('lets an authorized editor through', async () => {
    mockCaps(true);
    const { findByDisplayValue } = render(<NewNewsScreen />);
    await findByDisplayValue('Gran noticia');
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
