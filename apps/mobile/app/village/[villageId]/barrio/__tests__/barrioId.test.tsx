import { render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import BarrioDetailScreen from '../[barrioId]';
import { getPersonsByBarrio } from '@cultuvilla/shared/services/personService';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1', barrioId: 'b1' }),
  useFocusEffect: (cb: () => void) => cb(),
  router: { back: jest.fn(), push: jest.fn(), canGoBack: () => true, replace: jest.fn() },
}));
jest.mock('../../../../../lib/auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
jest.mock('../../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../../../lib/deeplink/useShareDeepLink', () => ({ useShareDeepLink: () => jest.fn() }));
jest.mock('../../../../../lib/useOwnerSummary', () => ({
  useOwnerSummary: () => ({ name: null, imageUri: null }),
}));
jest.mock('../../../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: () => ({ canManage: false, uid: 'u1', loading: false }),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getBarrio: jest.fn().mockResolvedValue({ id: 'b1', name: 'Centro', images: [], municipalityId: 'm1' }),
}));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({ getBarrioViewLink: () => 'https://x' }));
jest.mock('@cultuvilla/shared/services/personService', () => ({ getPersonsByBarrio: jest.fn().mockResolvedValue([]) }));
jest.mock('@cultuvilla/shared/models/person', () => ({
  buildNameWithNickname: (p: { id: string }) => p.id,
  isDeceased: (p: { deathDate?: unknown; burialPlace?: unknown }) =>
    p.deathDate != null || p.burialPlace != null,
}));
jest.mock('../../../../../components/feature/EntityComments', () => ({ EntityComments: () => null }));
jest.mock('@cultuvilla/shared/services/commentsService', () => ({ recordEntityView: jest.fn().mockResolvedValue(undefined) }));

describe('BarrioDetailScreen', () => {
  beforeEach(() => {
    jest.mocked(getPersonsByBarrio).mockReset();
    jest.mocked(getPersonsByBarrio).mockResolvedValue([]);
    jest.mocked(router.push).mockClear();
  });

  it('renders the barrio name once loaded', async () => {
    const { getByText } = render(<BarrioDetailScreen />);
    await waitFor(() => getByText('Centro'));
  });

  it('does not make an account-less persona clickable from the residents list', async () => {
    jest.mocked(getPersonsByBarrio).mockResolvedValue([
      { id: 'p1', userId: null, createdBy: 'u1' },
    ] as Awaited<ReturnType<typeof getPersonsByBarrio>>);

    const { queryByRole, findAllByText } = render(<BarrioDetailScreen />);

    await findAllByText('p1');
    expect(queryByRole('button', { name: 'p1' })).toBeNull();
    expect(router.push).not.toHaveBeenCalledWith('/person/p1');
  });

  it('hides deceased personas (death date or burial place) from the residents list', async () => {
    jest.mocked(getPersonsByBarrio).mockResolvedValue([
      { id: 'alive', userId: null, createdBy: 'u1' },
      { id: 'byDate', userId: null, createdBy: 'u1', deathDate: { year: 2020, month: null, day: null } },
      { id: 'byBurial', userId: null, createdBy: 'u1', burialPlace: { municipalityId: 'm1', placeId: 'c1' } },
    ] as unknown as Awaited<ReturnType<typeof getPersonsByBarrio>>);

    const { findByText, queryByText } = render(<BarrioDetailScreen />);

    // The living persona renders; the two deceased ones are filtered out.
    await findByText('alive');
    expect(queryByText('byDate')).toBeNull();
    expect(queryByText('byBurial')).toBeNull();
  });
});
