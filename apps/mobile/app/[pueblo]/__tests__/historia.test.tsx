import { render, waitFor } from '@testing-library/react-native';
import VillageHistoryScreen from '../historia';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { getHistoryEntries } from '@cultuvilla/shared/services/historyService';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ pueblo: 'villa' }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, [cb]);
  },
  router: { push: jest.fn() },
}));
jest.mock('../../../lib/navigation/VillageRouteGate');
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@cultuvilla/shared/services/historyService', () => ({
  getHistoryEntries: jest.fn(),
}));
jest.mock('../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: jest.fn(),
}));
jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../components/primitives/RemoteImage', () => ({ RemoteImage: () => null }));

const mockCaps = useEntityCapabilities as jest.Mock;
const mockEntries = getHistoryEntries as jest.Mock;

function entry(id: string, title: string, year: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    municipalityId: 'm1',
    villageSlug: 'villa',
    createdBy: 'alice',
    title,
    body: { text: '', mentions: [], links: [], marks: [] },
    images: [],
    start: { year, month: null, day: null },
    end: null,
    approximate: false,
    sources: null,
    sortKey: year * 10000,
    createdAt: new Date(),
    updatedAt: new Date(),
    commentCount: 0,
    readCount: 0,
    status: 'active',
    hiddenBy: null,
    hiddenAt: null,
    hiddenReason: null,
    ...extra,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCaps.mockReturnValue({ isMember: true, canManage: false, uid: 'u1', loading: false });
  mockEntries.mockResolvedValue([
    entry('a', 'Guerra Civil', 1936, { end: { year: 1939, month: null, day: null } }),
    entry('b', 'Se construye la iglesia', 1500, { approximate: true }),
    entry('c', 'Asentamiento romano', -218),
  ]);
});

describe('VillageHistoryScreen', () => {
  it('lists entries newest first, each with its loose date', async () => {
    const { getByText } = render(<VillageHistoryScreen />);
    await waitFor(() => expect(getByText('Guerra Civil')).toBeTruthy());
    expect(getByText('1936 – 1939')).toBeTruthy();
    expect(getByText('h. 1500')).toBeTruthy();
    expect(getByText('218 a. C.')).toBeTruthy();
  });

  it('opens each century with a divider', async () => {
    const { getByText } = render(<VillageHistoryScreen />);
    await waitFor(() => expect(getByText('Guerra Civil')).toBeTruthy());
    expect(getByText('Siglo XX')).toBeTruthy();
    expect(getByText('Siglo XV')).toBeTruthy();
    expect(getByText('Siglo III a. C.')).toBeTruthy();
  });

  it('offers the add action to a member', async () => {
    const { getByTestId, getByText } = render(<VillageHistoryScreen />);
    await waitFor(() => expect(getByText('Guerra Civil')).toBeTruthy());
    expect(getByTestId('history-add-fab')).toBeTruthy();
  });

  it('hides the add action from a non-member — reading stays open to everyone', async () => {
    mockCaps.mockReturnValue({ isMember: false, canManage: false, uid: null, loading: false });
    const { queryByTestId, getByText } = render(<VillageHistoryScreen />);
    await waitFor(() => expect(getByText('Guerra Civil')).toBeTruthy());
    expect(queryByTestId('history-add-fab')).toBeNull();
  });

  it('shows the empty state, with an invitation for members', async () => {
    mockEntries.mockResolvedValue([]);
    const { getByText } = render(<VillageHistoryScreen />);
    await waitFor(() => expect(getByText('village.history.empty')).toBeTruthy());
    expect(getByText('village.history.emptyMember')).toBeTruthy();
  });
});
