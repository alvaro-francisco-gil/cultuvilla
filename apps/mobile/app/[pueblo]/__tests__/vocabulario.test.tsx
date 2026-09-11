import { render, waitFor, fireEvent } from '@testing-library/react-native';
import VocabularyScreen from '../vocabulario';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { getVocabularyTerms } from '@cultuvilla/shared/services/vocabularyService';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1' }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, [cb]);
  },
  router: { push: jest.fn() },
}));
// ScreenHeader reads safe-area insets; provide them without a SafeAreaProvider.
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@cultuvilla/shared/services/vocabularyService', () => ({
  getVocabularyTerms: jest.fn(),
}));
jest.mock('../../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: jest.fn(),
}));
jest.mock('../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));

const mockCaps = useEntityCapabilities as jest.Mock;
const mockTerms = getVocabularyTerms as jest.Mock;

function term(id: string, word: string, normalized: string) {
  return {
    id,
    term: word,
    normalized,
    kind: 'palabra',
    municipalityId: 'm1',
    villageSlug: 'villa',
    createdBy: 'alice',
    createdAt: new Date(),
    definitionCount: 1,
    commentCount: 0,
    readCount: 0,
    status: 'active',
    hiddenBy: null,
    hiddenAt: null,
    hiddenReason: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCaps.mockReturnValue({ isMember: true, canManage: false, uid: 'u1', loading: false });
  mockTerms.mockResolvedValue([
    term('m1__esbardo', 'Esbardo', 'esbardo'),
    term('m1__napa', 'Ñapa', 'napa'),
  ]);
});

describe('VocabularyScreen', () => {
  it('lists the pueblo’s words', async () => {
    const { getByText } = render(<VocabularyScreen />);
    await waitFor(() => expect(getByText('Esbardo')).toBeTruthy());
    expect(getByText('Ñapa')).toBeTruthy();
  });

  // The search box filters the already-fetched list rather than re-querying,
  // and it matches on the accent-folded form — typing "napa" must find "Ñapa".
  it('filters in memory, folding accents, without a second fetch', async () => {
    const { getByTestId, getByText, queryByText } = render(<VocabularyScreen />);
    await waitFor(() => expect(getByText('Ñapa')).toBeTruthy());

    fireEvent.changeText(getByTestId('vocabulary-search'), 'napa');

    await waitFor(() => expect(queryByText('Esbardo')).toBeNull());
    expect(getByText('Ñapa')).toBeTruthy();
    expect(mockTerms).toHaveBeenCalledTimes(1);
  });

  it('offers the add action to a member', async () => {
    const { getByTestId, getByText } = render(<VocabularyScreen />);
    await waitFor(() => expect(getByText('Esbardo')).toBeTruthy());
    expect(getByTestId('vocabulary-add-fab')).toBeTruthy();
  });

  it('hides the add action from a non-member — reading stays open to everyone', async () => {
    mockCaps.mockReturnValue({ isMember: false, canManage: false, uid: null, loading: false });
    const { queryByTestId, getByText } = render(<VocabularyScreen />);
    await waitFor(() => expect(getByText('Esbardo')).toBeTruthy());
    expect(queryByTestId('vocabulary-add-fab')).toBeNull();
  });

  it('shows the empty state when the pueblo has recorded nothing yet', async () => {
    mockTerms.mockResolvedValue([]);
    const { getByText } = render(<VocabularyScreen />);
    await waitFor(() => expect(getByText('village.vocabulary.empty')).toBeTruthy());
  });
});
