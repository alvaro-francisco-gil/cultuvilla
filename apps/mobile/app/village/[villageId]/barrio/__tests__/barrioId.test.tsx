import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import BarrioDetailScreen from '../[barrioId]';
import { getMunicipalityPeopleByBarrio } from '@cultuvilla/shared/services/municipalityPersonService';

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
  useEntityCapabilities: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/municipalityService', () => ({
  getBarrio: jest.fn().mockResolvedValue({
    id: 'b1',
    name: 'Centro',
    images: [],
    municipalityId: 'm1',
    proposedBy: 'creator',
    status: 'active',
  }),
}));
jest.mock('@cultuvilla/shared/services/deepLinkService', () => ({ getBarrioViewLink: () => 'https://x' }));
jest.mock('@cultuvilla/shared/services/municipalityPersonService', () => ({
  getMunicipalityPeopleByBarrio: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../../../../components/feature/EntityComments', () => ({ EntityComments: () => null }));
jest.mock('@cultuvilla/shared/services/commentsService', () => ({ recordEntityView: jest.fn().mockResolvedValue(undefined) }));

type Row = Awaited<ReturnType<typeof getMunicipalityPeopleByBarrio>>[number];

const resident = (over: Partial<Row> & { personId: string }): Row =>
  ({
    id: `m1_${over.personId}`,
    municipalityId: 'm1',
    barrioId: 'b1',
    displayName: over.personId,
    sortName: over.personId,
    photoURL: null,
    userId: null,
    isPublic: true,
    ...over,
  }) as Row;

import { useEntityCapabilities } from '../../../../../lib/auth/useEntityCapabilities';

function mockCaps(opts: { canEdit?: boolean; uid?: string | null } = {}) {
  (useEntityCapabilities as jest.Mock).mockReturnValue({
    canManage: false,
    canApprove: false,
    uid: opts.uid ?? 'u1',
    loading: false,
    canEdit: jest.fn(() => opts.canEdit ?? false),
    canDelete: jest.fn(() => opts.canEdit ?? false),
  });
}

describe('BarrioDetailScreen', () => {
  beforeEach(() => {
    mockCaps();
    jest.mocked(getMunicipalityPeopleByBarrio).mockReset();
    jest.mocked(getMunicipalityPeopleByBarrio).mockResolvedValue([]);
    jest.mocked(router.push).mockClear();
  });

  it('renders the barrio name once loaded', async () => {
    const { getByText } = render(<BarrioDetailScreen />);
    await waitFor(() => getByText('Centro'));
  });

  it('shows the edit action to the barrio’s creator, not to an unrelated viewer', async () => {
    const { getByText, queryByLabelText } = render(<BarrioDetailScreen />);
    await waitFor(() => getByText('Centro'));
    expect(queryByLabelText('common.edit')).toBeNull();

    mockCaps({ canEdit: true, uid: 'creator' });
    const creatorView = render(<BarrioDetailScreen />);
    expect(await creatorView.findByLabelText('common.edit')).toBeTruthy();
  });

  // The barrio roster reads the municipalityPeople projection, not a persons
  // query — that is what lets a persona with no account appear here at all.
  it('lists a persona with no account and opens their details', async () => {
    jest.mocked(getMunicipalityPeopleByBarrio).mockResolvedValue([resident({ personId: 'p1' })]);

    const { findByRole } = render(<BarrioDetailScreen />);

    fireEvent.press(await findByRole('button', { name: 'p1' }));
    expect(router.push).toHaveBeenCalledWith('/person/p1');
  });

  it('lists a private persona but leaves the row unlinked', async () => {
    jest
      .mocked(getMunicipalityPeopleByBarrio)
      .mockResolvedValue([resident({ personId: 'p2', isPublic: false })]);

    const { findAllByText, queryByRole } = render(<BarrioDetailScreen />);

    await findAllByText('p2');
    expect(queryByRole('button', { name: 'p2' })).toBeNull();
    expect(router.push).not.toHaveBeenCalledWith('/person/p2');
  });

  it('opens the richer user profile for an account holder', async () => {
    jest
      .mocked(getMunicipalityPeopleByBarrio)
      .mockResolvedValue([resident({ personId: 'p3', userId: 'u9' })]);

    const { findByRole } = render(<BarrioDetailScreen />);

    fireEvent.press(await findByRole('button', { name: 'p3' }));
    expect(router.push).toHaveBeenCalledWith('/user/u9');
  });
});
