import { render, waitFor, fireEvent } from '@testing-library/react-native';
import VocabularyScreen from '../vocabulario';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { getVocabularyTerms } from '@cultuvilla/shared/services/vocabularyService';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ pueblo: 'villa' }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, [cb]);
  },
  router: { push: jest.fn() },
}));
// ScreenHeader reads safe-area insets; provide them without a SafeAreaProvider.
jest.mock('../../../lib/navigation/VillageRouteGate');
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@cultuvilla/shared/services/vocabularyService', () => ({
  getVocabularyTerms: jest.fn(),
}));
jest.mock('../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: jest.fn(),
}));
jest.mock('../../../components/feature/ContributorAvatars', () => {
  const { Text } = require('react-native');
  return {
    ContributorAvatars: ({ userIds }: { userIds: string[] }) => <Text>{`faces:${userIds.join(',')}`}</Text>,
  };
});
jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));

const mockCaps = useEntityCapabilities as jest.Mock;
const mockTerms = getVocabularyTerms as jest.Mock;

function term(id: string, word: string, normalized: string, kind = 'palabra') {
  return {
    id,
    term: word,
    normalized,
    kind,
    municipalityId: 'm1',
    createdBy: 'alice',
    contributorUserIds: ['alice'],
    contributorOrgIds: [],
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

  it('shows just the headword on each row, with no kind or meaning count', async () => {
    const { getByText, queryByText } = render(<VocabularyScreen />);
    await waitFor(() => expect(getByText('Esbardo')).toBeTruthy());
    expect(queryByText(/village.vocabulary.kind/)).toBeNull();
    expect(queryByText(/village.vocabulary.definitionCount/)).toBeNull();
  });

  it('shows who digitalized each word at the end of its row', async () => {
    const { getByText, getAllByText } = render(<VocabularyScreen />);
    await waitFor(() => expect(getByText('Esbardo')).toBeTruthy());
    expect(getAllByText('faces:alice')).toHaveLength(2);
  });

  it('needs no tabs while the pueblo has only one kind recorded', async () => {
    const { getByText, queryByText } = render(<VocabularyScreen />);
    await waitFor(() => expect(getByText('Esbardo')).toBeTruthy());
    expect(queryByText('village.vocabulary.kindPlural.palabra')).toBeNull();
  });

  describe('with several kinds recorded', () => {
    beforeEach(() => {
      mockTerms.mockResolvedValue([
        term('m1__esbardo', 'Esbardo', 'esbardo'),
        term('m1__en-abril-aguas-mil', 'En abril, aguas mil', 'en-abril-aguas-mil', 'dicho'),
      ]);
    });

    // Only kinds with entries get a tab — a village with no motes shows no Motes tab.
    it('offers a tab per recorded kind and opens on the first', async () => {
      const { getByText, queryByText } = render(<VocabularyScreen />);
      await waitFor(() => expect(getByText('Esbardo')).toBeTruthy());
      expect(getByText('village.vocabulary.kindPlural.palabra')).toBeTruthy();
      expect(getByText('village.vocabulary.kindPlural.dicho')).toBeTruthy();
      expect(queryByText('village.vocabulary.kindPlural.mote')).toBeNull();
      expect(queryByText('En abril, aguas mil')).toBeNull();
    });

    it('switches the list to the chosen kind', async () => {
      const { getByText, queryByText } = render(<VocabularyScreen />);
      await waitFor(() => expect(getByText('Esbardo')).toBeTruthy());
      fireEvent.press(getByText('village.vocabulary.kindPlural.dicho'));
      await waitFor(() => expect(getByText('En abril, aguas mil')).toBeTruthy());
      expect(queryByText('Esbardo')).toBeNull();
    });

    // Someone searching a saying from the Palabras tab still finds it.
    it('searches every kind, whichever tab is open', async () => {
      const { getByTestId, getByText } = render(<VocabularyScreen />);
      await waitFor(() => expect(getByText('Esbardo')).toBeTruthy());
      fireEvent.changeText(getByTestId('vocabulary-search'), 'abril');
      await waitFor(() => expect(getByText('En abril, aguas mil')).toBeTruthy());
    });

    // The search box sits under the tabs, so hiding them mid-search would yank
    // the field upward while the user is typing into it.
    it('keeps the tabs in place while searching', async () => {
      const { getByTestId, getByText } = render(<VocabularyScreen />);
      await waitFor(() => expect(getByText('Esbardo')).toBeTruthy());
      fireEvent.changeText(getByTestId('vocabulary-search'), 'abril');
      await waitFor(() => expect(getByText('En abril, aguas mil')).toBeTruthy());
      expect(getByText('village.vocabulary.kindPlural.palabra')).toBeTruthy();
    });
  });

  it('shows the empty state when the pueblo has recorded nothing yet', async () => {
    mockTerms.mockResolvedValue([]);
    const { getByText } = render(<VocabularyScreen />);
    await waitFor(() => expect(getByText('village.vocabulary.empty')).toBeTruthy());
  });
});
