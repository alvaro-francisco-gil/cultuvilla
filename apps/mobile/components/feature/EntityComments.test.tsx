import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { EntityComments } from './EntityComments';
import { addComment, deleteComment, getComments } from '@cultuvilla/shared/services/commentsService';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';

jest.mock('@cultuvilla/shared/services/commentsService', () => ({
  addComment: jest.fn(),
  deleteComment: jest.fn().mockResolvedValue(undefined),
  getComments: jest.fn(),
  reactToEntity: jest.fn().mockResolvedValue(undefined),
  removeReaction: jest.fn().mockResolvedValue(undefined),
  getMyReaction: jest.fn().mockResolvedValue(null),
}));
jest.mock('@cultuvilla/shared/services/personService', () => ({
  getPersonByUserId: jest.fn(),
}));
jest.mock('../../lib/auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'uid-1', email: 'a@b.test', displayName: null } }),
}));
jest.mock('../../lib/auth/RegisterGateContext', () => ({
  useRegisterGate: () => ({ requireAuth: jest.fn(), pendingIntent: null, clearPending: jest.fn() }),
}));
jest.mock('../../lib/i18n', () => ({
  useT: () => ({
    locale: 'es',
    t: (key: string) => {
      const table: Record<string, string> = {
        'comments.sectionTitle': 'Comentarios',
        'comments.empty': 'Sé el primero en comentar',
        'comments.placeholder': 'Escribe un comentario…',
        'comments.send': 'Enviar',
        'comments.signInToComment': 'Inicia sesión para comentar',
        'comments.delete': 'Eliminar',
        'comments.anonymousAuthor': 'Usuario',
      };
      return table[key] ?? key;
    },
  }),
}));
jest.mock('expo-router', () => ({
  usePathname: () => '/event/e-1',
}));

const getPersonByUserIdMock = getPersonByUserId as jest.Mock;
const getCommentsMock = getComments as jest.Mock;
const addCommentMock = addComment as jest.Mock;
const deleteCommentMock = deleteComment as jest.Mock;

const BASE_PROPS = {
  entityKind: 'event' as const,
  entityId: 'e-1',
  municipalityId: 'm-1',
  initialReactionCounts: { like: 0, heart: 0 },
};

describe('<EntityComments>', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPersonByUserIdMock.mockResolvedValue({
      givenName: 'Ana',
      middleNames: [],
      firstSurname: 'Gil',
      secondSurname: null,
    });
  });

  it('shows the empty state when there are no comments', async () => {
    getCommentsMock.mockResolvedValue([]);
    const { findByText } = render(<EntityComments {...BASE_PROPS} />);
    expect(await findByText('Sé el primero en comentar')).toBeTruthy();
  });

  it('renders existing comments with the resolved author name', async () => {
    getCommentsMock.mockResolvedValue([
      {
        id: 'c-1',
        entityKind: 'event',
        entityId: 'e-1',
        municipalityId: 'm-1',
        authorUserId: 'uid-2',
        body: 'Qué buena idea',
        createdAt: new Date(),
      },
    ]);
    const { findByText } = render(<EntityComments {...BASE_PROPS} />);
    expect(await findByText('Qué buena idea')).toBeTruthy();
    expect(await findByText('Ana Gil')).toBeTruthy();
  });

  it('optimistically appends a sent comment and clears the input', async () => {
    getCommentsMock.mockResolvedValue([]);
    addCommentMock.mockResolvedValue('c-new');
    const { findByPlaceholderText, findByText, getByText } = render(
      <EntityComments {...BASE_PROPS} />,
    );
    await findByText('Sé el primero en comentar');

    const input = await findByPlaceholderText('Escribe un comentario…');
    fireEvent.changeText(input, 'Un comentario nuevo');
    await act(async () => {
      fireEvent.press(getByText('Enviar'));
    });

    await waitFor(() => expect(addCommentMock).toHaveBeenCalledWith({
      entityKind: 'event',
      entityId: 'e-1',
      municipalityId: 'm-1',
      authorUserId: 'uid-1',
      body: 'Un comentario nuevo',
    }));
    expect(await findByText('Un comentario nuevo')).toBeTruthy();
    expect(input.props.value).toBe('');
  });

  it('shows a delete affordance for the comment author and removes it on confirm', async () => {
    getCommentsMock.mockResolvedValue([
      {
        id: 'c-1',
        entityKind: 'event',
        entityId: 'e-1',
        municipalityId: 'm-1',
        authorUserId: 'uid-1',
        body: 'Mi comentario',
        createdAt: new Date(),
      },
    ]);
    Platform.OS = 'web';
    // jsdom isn't loaded in this jest env, so window has no confirm to spy on —
    // install the mock directly (mirrors DeleteHeaderButton.test.tsx).
    const confirm = jest.fn<boolean, [string?]>().mockReturnValue(true);
    (globalThis as unknown as { window: { confirm: typeof confirm } }).window = {
      ...(globalThis as unknown as { window?: object }).window,
      confirm,
    } as never;

    const { findByText, findByLabelText, queryByText } = render(<EntityComments {...BASE_PROPS} />);
    await findByText('Mi comentario');

    await act(async () => {
      fireEvent.press(await findByLabelText('Eliminar'));
    });

    await waitFor(() => expect(deleteCommentMock).toHaveBeenCalledWith('c-1'));
    expect(queryByText('Mi comentario')).toBeNull();

    Platform.OS = 'ios';
  });
});
