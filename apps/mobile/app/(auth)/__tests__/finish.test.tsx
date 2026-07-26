import { render, waitFor } from '@testing-library/react-native';
import FinishScreen from '../finish';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn().mockResolvedValue('https://villa-events.web.app/finish?mode=signIn'),
}));

jest.mock('../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (key: string) => key }),
}));

const mockIsEmailLink = jest.fn().mockReturnValue(true);
const mockCompleteReauth = jest.fn();
const mockReadPendingReauth = jest.fn();
const mockClearPendingReauth = jest.fn().mockResolvedValue(undefined);

const mockUseAuth = jest.fn();
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

function baseAuth(overrides: Partial<ReturnType<typeof mockUseAuth>> = {}) {
  return {
    user: null,
    loading: false,
    isEmailLink: mockIsEmailLink,
    completeReauth: mockCompleteReauth,
    readPendingReauth: mockReadPendingReauth,
    clearPendingReauth: mockClearPendingReauth,
    ...overrides,
  };
}

describe('<FinishScreen> re-auth wedge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsEmailLink.mockReturnValue(true);
  });

  it('clears a stale pending-reauth intent and shows an invalid-link error when no session is present', async () => {
    mockReadPendingReauth.mockResolvedValue({ purpose: 'change-email', newEmail: 'new@test.com' });
    mockUseAuth.mockReturnValue(baseAuth({ user: null }));

    const { queryByText } = render(<FinishScreen />);

    await waitFor(() => expect(mockClearPendingReauth).toHaveBeenCalled());

    expect(mockCompleteReauth).not.toHaveBeenCalled();
    await waitFor(() => expect(queryByText('auth.emailLink.invalidTitle')).toBeTruthy());
  });

  it('completes the re-auth normally when a session is present', async () => {
    mockReadPendingReauth.mockResolvedValue({ purpose: 'change-email', newEmail: 'new@test.com' });
    mockCompleteReauth.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(baseAuth({ user: { uid: 'u1' } }));

    render(<FinishScreen />);

    await waitFor(() => expect(mockCompleteReauth).toHaveBeenCalled());
    expect(mockClearPendingReauth).not.toHaveBeenCalled();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/settings'));
  });

  it('waits for the initial auth state before deciding whether a session is present', async () => {
    mockReadPendingReauth.mockResolvedValue({ purpose: 'change-email', newEmail: 'new@test.com' });
    mockUseAuth.mockReturnValue(baseAuth({ user: null, loading: true }));

    render(<FinishScreen />);

    // Auth is still resolving — must not prematurely clear the intent.
    await new Promise((r) => setTimeout(r, 0));
    expect(mockClearPendingReauth).not.toHaveBeenCalled();
    expect(mockCompleteReauth).not.toHaveBeenCalled();
  });

  it('shows an invalid-link error when there is no pending-reauth intent at all', async () => {
    mockReadPendingReauth.mockResolvedValue(null);
    mockUseAuth.mockReturnValue(baseAuth({ user: { uid: 'u1' } }));

    const { queryByText } = render(<FinishScreen />);

    await waitFor(() => expect(queryByText('auth.emailLink.invalidTitle')).toBeTruthy());
    expect(mockCompleteReauth).not.toHaveBeenCalled();
  });
});
