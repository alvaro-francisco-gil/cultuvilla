import { render, fireEvent, waitFor, act, within } from '@testing-library/react-native';
import { ReactionBar } from './ReactionBar';
import {
  getMyReaction,
  reactToEntity,
  removeReaction,
} from '@cultuvilla/shared/services/commentsService';

jest.mock('@cultuvilla/shared/services/commentsService', () => ({
  getMyReaction: jest.fn().mockResolvedValue(null),
  reactToEntity: jest.fn().mockResolvedValue(undefined),
  removeReaction: jest.fn().mockResolvedValue(undefined),
}));

let mockUser: { uid: string; email: string; displayName: string | null } | null = {
  uid: 'uid-1',
  email: 'a@b.test',
  displayName: null,
};
const mockRequireAuth = jest.fn();
jest.mock('../../lib/auth/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock('../../lib/auth/RegisterGateContext', () => ({
  useRegisterGate: () => ({ requireAuth: mockRequireAuth, pendingIntent: null, clearPending: jest.fn() }),
}));
jest.mock('../../lib/i18n', () => ({
  useT: () => ({
    locale: 'es',
    t: (key: string) => {
      const table: Record<string, string> = {
        'comments.reactionLike': 'Me gusta',
        'comments.reactionHeart': 'Encanta',
        'guest.comment': 'Regístrate para comentar',
      };
      return table[key] ?? key;
    },
  }),
}));
jest.mock('expo-router', () => ({
  usePathname: () => '/event/e-1',
}));

const getMyReactionMock = getMyReaction as jest.Mock;
const reactToEntityMock = reactToEntity as jest.Mock;
const removeReactionMock = removeReaction as jest.Mock;

const BASE_PROPS = {
  entityKind: 'event' as const,
  entityId: 'e-1',
  municipalityId: 'm-1',
  initialCounts: { like: 2, heart: 1 },
};

describe('<ReactionBar>', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { uid: 'uid-1', email: 'a@b.test', displayName: null };
    getMyReactionMock.mockResolvedValue(null);
  });

  it('renders both pills with the initial counts', async () => {
    const { findByText, getByText } = render(<ReactionBar {...BASE_PROPS} />);
    expect(await findByText('2')).toBeTruthy();
    expect(getByText('1')).toBeTruthy();
  });

  it('highlights the active pill from the initial getMyReaction result', async () => {
    getMyReactionMock.mockResolvedValue('like');
    const { findByLabelText } = render(<ReactionBar {...BASE_PROPS} />);
    const likePill = await findByLabelText('Me gusta');
    await waitFor(() => expect(likePill.props.accessibilityState?.selected).toBe(true));
    const heartPill = await findByLabelText('Encanta');
    expect(heartPill.props.accessibilityState?.selected).toBe(false);
  });

  it('tapping an inactive kind reacts and increments its count optimistically', async () => {
    const { findByLabelText, findByText } = render(<ReactionBar {...BASE_PROPS} />);
    const likePill = await findByLabelText('Me gusta');

    await act(async () => {
      fireEvent.press(likePill);
    });

    expect(reactToEntityMock).toHaveBeenCalledWith({
      entityKind: 'event',
      entityId: 'e-1',
      municipalityId: 'm-1',
      userId: 'uid-1',
      kind: 'like',
    });
    expect(await findByText('3')).toBeTruthy();
  });

  it('tapping the active kind removes the reaction and decrements its count', async () => {
    getMyReactionMock.mockResolvedValue('like');
    const { findByLabelText } = render(<ReactionBar {...BASE_PROPS} />);
    const likePill = await findByLabelText('Me gusta');
    await waitFor(() => expect(likePill.props.accessibilityState?.selected).toBe(true));

    await act(async () => {
      fireEvent.press(likePill);
    });

    expect(removeReactionMock).toHaveBeenCalledWith('event', 'e-1', 'uid-1');
    expect(reactToEntityMock).not.toHaveBeenCalled();
    await waitFor(() => expect(within(likePill).getByText('1')).toBeTruthy());
    await waitFor(() => expect(likePill.props.accessibilityState?.selected).toBe(false));
  });

  it('switching from like to heart decrements like and increments heart without double-counting', async () => {
    getMyReactionMock.mockResolvedValue('like');
    const { findByLabelText, findByText, queryAllByText } = render(<ReactionBar {...BASE_PROPS} />);
    const likePill = await findByLabelText('Me gusta');
    await waitFor(() => expect(likePill.props.accessibilityState?.selected).toBe(true));
    const heartPill = await findByLabelText('Encanta');

    await act(async () => {
      fireEvent.press(heartPill);
    });

    expect(reactToEntityMock).toHaveBeenCalledWith({
      entityKind: 'event',
      entityId: 'e-1',
      municipalityId: 'm-1',
      userId: 'uid-1',
      kind: 'heart',
    });
    expect(removeReactionMock).not.toHaveBeenCalled();
    // like: 2 -> 1, heart: 1 -> 2 — both counts read "1" and "2" at once, but
    // never "0" or "3" (which would signal a double-count in either direction).
    expect(queryAllByText('0')).toHaveLength(0);
    expect(queryAllByText('3')).toHaveLength(0);
    expect(await findByText('1')).toBeTruthy();
    expect(await findByText('2')).toBeTruthy();
    await waitFor(() => expect(heartPill.props.accessibilityState?.selected).toBe(true));
    await waitFor(() => expect(likePill.props.accessibilityState?.selected).toBe(false));
  });

  it('signed-out tap routes through the register gate and does not react', async () => {
    mockUser = null;
    const { findByLabelText } = render(<ReactionBar {...BASE_PROPS} />);
    const likePill = await findByLabelText('Me gusta');

    await act(async () => {
      fireEvent.press(likePill);
    });

    expect(mockRequireAuth).toHaveBeenCalledWith('/event/e-1', 'Regístrate para comentar');
    expect(reactToEntityMock).not.toHaveBeenCalled();
    expect(removeReactionMock).not.toHaveBeenCalled();
  });
});
