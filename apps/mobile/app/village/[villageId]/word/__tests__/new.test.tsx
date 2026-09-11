import { render, fireEvent, waitFor } from '@testing-library/react-native';
import NewVocabularyTermScreen from '../new';
import { addVocabularyEntry } from '@cultuvilla/shared/services/vocabularyService';
import { useEntityCapabilities } from '../../../../../lib/auth/useEntityCapabilities';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ villageId: 'm1' }),
  router: { replace: (...args: unknown[]) => mockReplace(...args), back: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@cultuvilla/shared/services/vocabularyService', () => ({
  addVocabularyEntry: jest.fn().mockResolvedValue('m1__esbardo'),
}));
jest.mock('../../../../../lib/auth/useEntityCapabilities', () => ({
  useEntityCapabilities: jest.fn(),
}));
jest.mock('../../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
// Stands in for the villager/group picker: one button that credits a neighbour
// and a peña, and echoes back which user it was told is the locked author.
jest.mock('../../../../../components/feature/OrganizerPicker', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    OrganizerPicker: ({
      selectedUserIds,
      lockedUserId,
      onChangeUsers,
      onChangeOrgs,
    }: {
      selectedUserIds: string[];
      lockedUserId?: string;
      onChangeUsers: (ids: string[]) => void;
      onChangeOrgs: (ids: string[]) => void;
    }) => (
      <Pressable
        testID="mock-credit"
        onPress={() => {
          onChangeUsers([...selectedUserIds, 'bob']);
          onChangeOrgs(['pena-el-botijo']);
        }}
      >
        <Text>{`locked:${lockedUserId}`}</Text>
      </Pressable>
    ),
  };
});

const mockCaps = useEntityCapabilities as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockCaps.mockReturnValue({ isMember: true, canManage: false, uid: 'alice', loading: false });
});

function fillWord(getByTestId: (id: string) => unknown) {
  fireEvent.changeText(getByTestId('vocabulary-term-input') as never, 'Esbardo');
  fireEvent.changeText(getByTestId('vocabulary-definition-input') as never, 'Cría de oso.');
}

describe('Añadir palabra — digitization credit', () => {
  it('sends no extra credit when nobody else is named — the model adds the author on write', async () => {
    const { getByTestId, getByText } = render(<NewVocabularyTermScreen />);
    fillWord(getByTestId);
    fireEvent.press(getByText('common.stepper.next'));
    fireEvent.press(getByTestId('vocabulary-submit'));

    await waitFor(() =>
      expect(addVocabularyEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          municipalityId: 'm1',
          term: 'Esbardo',
          definition: 'Cría de oso.',
          createdBy: 'alice',
          contributorUserIds: [],
          contributorOrgIds: [],
        }),
      ),
    );
  });

  it('passes the villagers and groups picked on the digitization step', async () => {
    const { getByTestId, getByText } = render(<NewVocabularyTermScreen />);
    fillWord(getByTestId);
    fireEvent.press(getByText('common.stepper.next'));
    fireEvent.press(getByTestId('mock-credit'));
    fireEvent.press(getByTestId('vocabulary-submit'));

    await waitFor(() =>
      expect(addVocabularyEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          contributorUserIds: ['alice', 'bob'],
          contributorOrgIds: ['pena-el-botijo'],
        }),
      ),
    );
  });

  it('locks the author into the picker, so they cannot uncredit themselves', () => {
    const { getByTestId, getByText } = render(<NewVocabularyTermScreen />);
    fillWord(getByTestId);
    fireEvent.press(getByText('common.stepper.next'));
    expect(getByText('locked:alice')).toBeTruthy();
  });

  it('opens the word it just recorded', async () => {
    const { getByTestId, getByText } = render(<NewVocabularyTermScreen />);
    fillWord(getByTestId);
    fireEvent.press(getByText('common.stepper.next'));
    fireEvent.press(getByTestId('vocabulary-submit'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/village/m1/word/m1__esbardo'));
  });

  it('does not advance past the word step without a word and a meaning', () => {
    const { getByText, queryByTestId } = render(<NewVocabularyTermScreen />);
    fireEvent.press(getByText('common.stepper.next'));
    expect(queryByTestId('mock-credit')).toBeNull();
  });
});
