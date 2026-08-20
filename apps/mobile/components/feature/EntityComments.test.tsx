import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { EntityComments } from './EntityComments';
import {
  addComment,
  deleteComment,
  getComments,
  getReplies,
} from '@cultuvilla/shared/services/commentsService';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { getUserProfile } from '@cultuvilla/shared/services/userService';

jest.mock('@cultuvilla/shared/services/commentsService', () => ({
  addComment: jest.fn(),
  deleteComment: jest.fn().mockResolvedValue(undefined),
  getComments: jest.fn(),
  getReplies: jest.fn(),
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
    t: (key: string, params?: Record<string, unknown>) => {
      const table: Record<string, string> = {
        'comments.sectionTitle': 'Comentarios',
        'comments.placeholder': 'Escribe un comentario…',
        'comments.send': 'Enviar',
        'comments.signInToComment': 'Inicia sesión para comentar',
        'comments.delete': 'Eliminar',
        'comments.anonymousAuthor': 'Usuario',
        'settings.deletedUser': 'Usuario eliminado',
        'comments.reply': 'Responder',
        'comments.replyPlaceholder': 'Escribe una respuesta…',
        'comments.hideReplies': 'Ocultar respuestas',
        'comments.cancelReply': 'Cancelar respuesta',
      };
      if (key === 'comments.viewReplies') return `Ver ${params?.count ?? ''} respuestas`;
      if (key === 'comments.replyingTo') return `Respondiendo a ${String(params?.name ?? '')}`;
      return table[key] ?? key;
    },
  }),
}));
jest.mock('expo-router', () => ({
  usePathname: () => '/event/e-1',
  router: { push: jest.fn() },
}));
const { router: mockRouter } = jest.requireMock('expo-router');

const getPersonByUserIdMock = getPersonByUserId as jest.Mock;
const getUserProfileMock = getUserProfile as jest.Mock;
const getCommentsMock = getComments as jest.Mock;
const addCommentMock = addComment as jest.Mock;
const deleteCommentMock = deleteComment as jest.Mock;
const getRepliesMock = getReplies as jest.Mock;

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
    expect(await findByText('Qué buena idea')).toBeTruthy();
    expect(await findByText('Ana Gil')).toBeTruthy();
    // The age of the comment sits next to the name, in its compact form.
    expect(await findByText('ahora')).toBeTruthy();
  });

  it('hides the send affordance until the composer has something to send', async () => {
    getCommentsMock.mockResolvedValue([]);
    const { findByPlaceholderText, queryByTestId, getByTestId } = render(
      <EntityComments {...BASE_PROPS} />,
    );
    const input = await findByPlaceholderText('Escribe un comentario…');
    expect(queryByTestId('comment-send')).toBeNull();

    fireEvent.changeText(input, 'Hola');
    expect(getByTestId('comment-send')).toBeTruthy();

    // Whitespace alone is not something to send.
    fireEvent.changeText(input, '   ');
    expect(queryByTestId('comment-send')).toBeNull();
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

  it('keeps the other authors named when one author lookup is denied', async () => {
    // The persons read rule is evaluated per matched document, so one private
    // persona denies that whole query — it must not cost the rest of the thread
    // its names, which is how everyone used to collapse to "Usuario".
    getPersonByUserIdMock.mockImplementation(async (uid: string) => {
      if (uid === 'uid-3') {
        throw Object.assign(new Error('Missing or insufficient permissions.'), {
          code: 'permission-denied',
        });
      }
      return { givenName: 'Ana', middleNames: [], firstSurname: 'Gil', secondSurname: null };
    });
    getUserProfileMock.mockImplementation(async (uid: string) =>
      uid === 'uid-3' ? { id: uid, displayName: 'Bea Ruiz' } : null,
    );
    getCommentsMock.mockResolvedValue([
      {
        id: 'c-1',
        entityKind: 'event',
        entityId: 'e-1',
        municipalityId: 'm-1',
        authorUserId: 'uid-2',
        body: 'Primero',
        createdAt: new Date(),
      },
      {
        id: 'c-2',
        entityKind: 'event',
        entityId: 'e-1',
        municipalityId: 'm-1',
        authorUserId: 'uid-3',
        body: 'Segundo',
        createdAt: new Date(),
      },
    ]);

    const { findByText, queryByText } = render(<EntityComments {...BASE_PROPS} />);

    expect(await findByText('Ana Gil')).toBeTruthy();
    expect(await findByText('Bea Ruiz')).toBeTruthy();
    expect(queryByText(/^Usuario$/)).toBeNull();
  });

  it('shows a placeholder rather than the anonymous fallback while a name resolves', async () => {
    let resolvePerson: (value: unknown) => void = () => {};
    // Only the comment author's lookup is held open — the signed-in user's own
    // lookup (the composer avatar) resolves straight away.
    getPersonByUserIdMock.mockImplementation(async (uid: string) => {
      if (uid !== 'uid-2') return null;
      return new Promise((resolve) => {
        resolvePerson = resolve;
      });
    });
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

    const { findByText, findByTestId, queryByText, queryByTestId } = render(
      <EntityComments {...BASE_PROPS} />,
    );

    await findByText('Qué buena idea');
    expect(await findByTestId('comment-author-pending-c-1')).toBeTruthy();
    expect(queryByText(/^Usuario$/)).toBeNull();

    await act(async () => {
      resolvePerson({ givenName: 'Ana', middleNames: [], firstSurname: 'Gil', secondSurname: null });
    });

    expect(await findByText('Ana Gil')).toBeTruthy();
    expect(queryByTestId('comment-author-pending-c-1')).toBeNull();
  });

  it('names a comment left by a since-deleted account', async () => {
    getCommentsMock.mockResolvedValue([
      {
        id: 'c-1',
        entityKind: 'event',
        entityId: 'e-1',
        municipalityId: 'm-1',
        authorUserId: 'deleted-user',
        body: 'Adiós',
        createdAt: new Date(),
      },
    ]);

    const { findByText, queryByText } = render(<EntityComments {...BASE_PROPS} />);

    expect(await findByText('Usuario eliminado')).toBeTruthy();
    expect(queryByText(/^Usuario$/)).toBeNull();
  });

  it('optimistically appends a sent comment and clears the input', async () => {
    getCommentsMock.mockResolvedValue([]);
    addCommentMock.mockResolvedValue('c-new');
    const { findByPlaceholderText, findByText, getByTestId } = render(
      <EntityComments {...BASE_PROPS} />,
    );
    const input = await findByPlaceholderText('Escribe un comentario…');
    fireEvent.changeText(input, 'Un comentario nuevo');
    // The send affordance only appears once there is something to send.
    await act(async () => {
      fireEvent.press(getByTestId('comment-send'));
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

  it('reuses the single composer for replies, marking who is being replied to', async () => {
    getCommentsMock.mockResolvedValue([
      {
        id: 'c-1',
        entityKind: 'event',
        entityId: 'e-1',
        municipalityId: 'm-1',
        authorUserId: 'uid-2',
        body: 'Comentario original',
        createdAt: new Date(),
        parentCommentId: null,
        replyCount: 0,
      },
    ]);
    addCommentMock.mockResolvedValue('r-new');
    getRepliesMock.mockResolvedValue([]);

    const { findByText, findByPlaceholderText, getByTestId, queryByText, queryByPlaceholderText } =
      render(<EntityComments {...BASE_PROPS} />);
    await findByText('Comentario original');

    // No second field appears — the one composer switches into reply mode.
    fireEvent.press(await findByText('Responder'));
    expect(await findByText('Respondiendo a Ana Gil')).toBeTruthy();
    expect(queryByPlaceholderText('Escribe un comentario…')).toBeNull();

    const input = await findByPlaceholderText('Escribe una respuesta…');
    fireEvent.changeText(input, 'Una respuesta');
    await act(async () => {
      fireEvent.press(getByTestId('comment-send'));
    });

    await waitFor(() =>
      expect(addCommentMock).toHaveBeenCalledWith({
        entityKind: 'event',
        entityId: 'e-1',
        municipalityId: 'm-1',
        authorUserId: 'uid-1',
        body: 'Una respuesta',
        parentCommentId: 'c-1',
      }),
    );
    // Sending drops back to composing a top-level comment.
    await waitFor(() => expect(queryByText('Respondiendo a Ana Gil')).toBeNull());
  });

  it('cancels reply mode and posts a top-level comment instead', async () => {
    getCommentsMock.mockResolvedValue([
      {
        id: 'c-1',
        entityKind: 'event',
        entityId: 'e-1',
        municipalityId: 'm-1',
        authorUserId: 'uid-2',
        body: 'Comentario original',
        createdAt: new Date(),
        parentCommentId: null,
        replyCount: 0,
      },
    ]);
    addCommentMock.mockResolvedValue('c-new');

    const { findByText, findByPlaceholderText, getByTestId, queryByText } = render(
      <EntityComments {...BASE_PROPS} />,
    );
    await findByText('Comentario original');
    fireEvent.press(await findByText('Responder'));
    fireEvent.press(getByTestId('comment-reply-cancel'));
    expect(queryByText('Respondiendo a Ana Gil')).toBeNull();

    fireEvent.changeText(await findByPlaceholderText('Escribe un comentario…'), 'Un comentario');
    await act(async () => {
      fireEvent.press(getByTestId('comment-send'));
    });

    await waitFor(() =>
      expect(addCommentMock).toHaveBeenCalledWith({
        entityKind: 'event',
        entityId: 'e-1',
        municipalityId: 'm-1',
        authorUserId: 'uid-1',
        body: 'Un comentario',
      }),
    );
  });

  it('shows a "view replies" toggle and loads/renders replies on press', async () => {
    getCommentsMock.mockResolvedValue([
      {
        id: 'c-1',
        entityKind: 'event',
        entityId: 'e-1',
        municipalityId: 'm-1',
        authorUserId: 'uid-2',
        body: 'Comentario original',
        createdAt: new Date(),
        parentCommentId: null,
        replyCount: 2,
      },
    ]);
    getRepliesMock.mockResolvedValue([
      {
        id: 'r-1',
        entityKind: 'event',
        entityId: 'e-1',
        municipalityId: 'm-1',
        authorUserId: 'uid-3',
        body: 'Una respuesta existente',
        createdAt: new Date(),
        parentCommentId: 'c-1',
        replyCount: 0,
      },
    ]);

    const { findByText } = render(<EntityComments {...BASE_PROPS} />);
    await findByText(/Comentario original/);

    const toggle = await findByText('Ver 2 respuestas');
    await act(async () => {
      fireEvent.press(toggle);
    });

    expect(getRepliesMock).toHaveBeenCalledWith('event', 'e-1', 'c-1');
    expect(await findByText(/Una respuesta existente/)).toBeTruthy();
  });

  it('does not render a reply action on a reply row (one level of nesting only)', async () => {
    getCommentsMock.mockResolvedValue([
      {
        id: 'c-1',
        entityKind: 'event',
        entityId: 'e-1',
        municipalityId: 'm-1',
        authorUserId: 'uid-2',
        body: 'Comentario original',
        createdAt: new Date(),
        parentCommentId: null,
        replyCount: 1,
      },
    ]);
    getRepliesMock.mockResolvedValue([
      {
        id: 'r-1',
        entityKind: 'event',
        entityId: 'e-1',
        municipalityId: 'm-1',
        authorUserId: 'uid-3',
        body: 'Una respuesta existente',
        createdAt: new Date(),
        parentCommentId: 'c-1',
        replyCount: 0,
      },
    ]);

    const { findByText, getAllByText } = render(<EntityComments {...BASE_PROPS} />);
    await findByText(/Comentario original/);

    await act(async () => {
      fireEvent.press(await findByText('Ver 1 respuestas'));
    });
    await findByText(/Una respuesta existente/);

    // Only the top-level comment's "Responder" affordance should exist —
    // the reply row must not render its own.
    expect(getAllByText('Responder')).toHaveLength(1);
  });

  it('opens the author profile from a comment name and avatar', async () => {
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
    const { findByTestId } = render(<EntityComments {...BASE_PROPS} />);

    fireEvent.press(await findByTestId('comment-author-c-1'));
    expect(mockRouter.push).toHaveBeenCalledWith('/user/uid-2');

    mockRouter.push.mockClear();
    fireEvent.press(await findByTestId('comment-author-avatar-c-1'));
    expect(mockRouter.push).toHaveBeenCalledWith('/user/uid-2');
  });

  it('opens the author profile from a reply', async () => {
    getCommentsMock.mockResolvedValue([
      {
        id: 'c-1',
        entityKind: 'event',
        entityId: 'e-1',
        municipalityId: 'm-1',
        authorUserId: 'uid-2',
        body: 'Comentario original',
        createdAt: new Date(),
        parentCommentId: null,
        replyCount: 1,
      },
    ]);
    getRepliesMock.mockResolvedValue([
      {
        id: 'r-1',
        entityKind: 'event',
        entityId: 'e-1',
        municipalityId: 'm-1',
        authorUserId: 'uid-3',
        body: 'Una respuesta existente',
        createdAt: new Date(),
        parentCommentId: 'c-1',
        replyCount: 0,
      },
    ]);
    const { findByText, findByTestId } = render(<EntityComments {...BASE_PROPS} />);
    await findByText(/Comentario original/);
    await act(async () => {
      fireEvent.press(await findByText('Ver 1 respuestas'));
    });

    fireEvent.press(await findByTestId('comment-author-r-1'));
    expect(mockRouter.push).toHaveBeenCalledWith('/user/uid-3');
  });

  it('leaves a deleted author inert instead of routing to a tombstone uid', async () => {
    getCommentsMock.mockResolvedValue([
      {
        id: 'c-1',
        entityKind: 'event',
        entityId: 'e-1',
        municipalityId: 'm-1',
        authorUserId: 'deleted-user',
        body: 'Comentario huérfano',
        createdAt: new Date(),
      },
    ]);
    const { findByText, queryByTestId } = render(<EntityComments {...BASE_PROPS} />);
    await findByText(/Comentario huérfano/);
    expect(queryByTestId('comment-author-c-1')).toBeNull();
    expect(queryByTestId('comment-author-avatar-c-1')).toBeNull();
  });
});
