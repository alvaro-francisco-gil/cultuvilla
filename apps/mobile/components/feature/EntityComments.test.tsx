import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { EntityComments } from './EntityComments';
import { addComment, deleteComment, getComments } from '@cultuvilla/shared/services/commentsService';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { getUserProfile } from '@cultuvilla/shared/services/userService';

jest.mock('@cultuvilla/shared/services/commentsService', () => ({
  addComment: jest.fn(),
  deleteComment: jest.fn().mockResolvedValue(undefined),
  getComments: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/personService', () => ({
  getPersonByUserId: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/userService', () => ({
  getUserProfile: jest.fn(),
}));
let mockUser: { uid: string; email: string; displayName: string | null } | null = {
  uid: 'uid-1',
  email: 'a@b.test',
  displayName: null,
};
jest.mock('../../lib/auth/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));
const mockRequireAuth = jest.fn();
jest.mock('../../lib/auth/RegisterGateContext', () => ({
  useRegisterGate: () => ({ requireAuth: mockRequireAuth, pendingIntent: null, clearPending: jest.fn() }),
}));
jest.mock('../../lib/i18n', () => ({
  useT: () => ({
    locale: 'es',
    t: (key: string) => {
      const table: Record<string, string> = {
        'comments.sectionTitle': 'Comentarios',
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
const getUserProfileMock = getUserProfile as jest.Mock;
const getCommentsMock = getComments as jest.Mock;
const addCommentMock = addComment as jest.Mock;
const deleteCommentMock = deleteComment as jest.Mock;

const BASE_PROPS = {
  entityKind: 'event' as const,
  entityId: 'e-1',
  municipalityId: 'm-1',
};

describe('<EntityComments>', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { uid: 'uid-1', email: 'a@b.test', displayName: null };
    getPersonByUserIdMock.mockResolvedValue({
      givenName: 'Ana',
      middleNames: [],
      firstSurname: 'Gil',
      secondSurname: null,
    });
    getUserProfileMock.mockResolvedValue(null);
  });

  it('renders nothing in place of the comment list when there are no comments', async () => {
    getCommentsMock.mockResolvedValue([]);
    const { findByText, queryByTestId } = render(<EntityComments {...BASE_PROPS} />);
    // Compose input still renders — only the (now-removed) empty-state message is absent.
    await findByText('Comentarios');
    expect(queryByTestId('reaction-like')).toBeNull();
    expect(queryByTestId('reaction-heart')).toBeNull();
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
    // Name + body share one Text node (Instagram-style inline), so match the
    // body as a substring rather than an exact text node.
    expect(await findByText(/Qué buena idea/)).toBeTruthy();
    expect(await findByText('Ana Gil')).toBeTruthy();
  });

  it('uses the public user display name while a new author persona is unavailable', async () => {
    getPersonByUserIdMock.mockResolvedValue(null);
    getUserProfileMock.mockResolvedValue({ id: 'uid-2', displayName: 'Bea Ruiz' });
    getCommentsMock.mockResolvedValue([
      {
        id: 'c-1',
        entityKind: 'event',
        entityId: 'e-1',
        municipalityId: 'm-1',
        authorUserId: 'uid-2',
        body: 'Recién registrado',
        createdAt: new Date(),
      },
    ]);

    const { findByText, queryByText } = render(<EntityComments {...BASE_PROPS} />);

    expect(await findByText('Bea Ruiz')).toBeTruthy();
    expect(queryByText(/^Usuario$/)).toBeNull();
  });

  it('optimistically appends a sent comment and clears the input', async () => {
    getCommentsMock.mockResolvedValue([]);
    addCommentMock.mockResolvedValue('c-new');
    const { findByPlaceholderText, findByText, getByText } = render(
      <EntityComments {...BASE_PROPS} />,
    );
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
    expect(await findByText(/Un comentario nuevo/)).toBeTruthy();
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
    await findByText(/Mi comentario/);

    await act(async () => {
      fireEvent.press(await findByLabelText('Eliminar'));
    });

    await waitFor(() => expect(deleteCommentMock).toHaveBeenCalledWith('c-1'));
    expect(queryByText(/Mi comentario/)).toBeNull();

    Platform.OS = 'ios';
  });

  it('shows the sign-in prompt instead of the compose input when signed out', async () => {
    mockUser = null;
    getCommentsMock.mockResolvedValue([]);
    const { findByText, queryByPlaceholderText } = render(<EntityComments {...BASE_PROPS} />);

    expect(await findByText('Inicia sesión para comentar')).toBeTruthy();
    expect(queryByPlaceholderText('Escribe un comentario…')).toBeNull();
  });

  it('routes the sign-in prompt through the register gate instead of posting a comment', async () => {
    mockUser = null;
    getCommentsMock.mockResolvedValue([]);
    const { findByText } = render(<EntityComments {...BASE_PROPS} />);

    const signInButton = await findByText('Inicia sesión para comentar');
    await act(async () => {
      fireEvent.press(signInButton);
    });

    expect(mockRequireAuth).toHaveBeenCalledWith('/event/e-1', 'guest.comment');
    expect(addCommentMock).not.toHaveBeenCalled();
  });
});
