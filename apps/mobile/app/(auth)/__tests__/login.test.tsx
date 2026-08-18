import { fireEvent, render, waitFor } from '@testing-library/react-native';
import LoginScreen from '../login';

jest.mock('../../../lib/i18n', () => ({
  useT: () => ({
    locale: 'es',
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
}));

const mockSendOtpCode = jest.fn();
const mockVerifyOtpCode = jest.fn();
const mockSignInWithGoogle = jest.fn();

const mockUseAuth = jest.fn();
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({
    sendOtpCode: mockSendOtpCode,
    verifyOtpCode: mockVerifyOtpCode,
    signInWithGoogle: mockSignInWithGoogle,
  });
});

describe('<LoginScreen>', () => {
  it('sends a code and advances to the code step', async () => {
    mockSendOtpCode.mockResolvedValue(undefined);
    const { getByTestId, queryByTestId } = render(<LoginScreen />);

    fireEvent.press(getByTestId('login-submit'));

    await waitFor(() => expect(getByTestId('login-code-input')).toBeTruthy());
    expect(mockSendOtpCode).toHaveBeenCalledTimes(1);
    expect(queryByTestId('login-submit')).toBeNull();
  });

  it('shows an error and stays on the email step when sending the code fails', async () => {
    mockSendOtpCode.mockRejectedValue(new Error('Email inválido.'));
    const { getByTestId, queryByTestId, findByText } = render(<LoginScreen />);

    fireEvent.press(getByTestId('login-submit'));

    await findByText('Email inválido.');
    expect(queryByTestId('login-code-input')).toBeNull();
  });

  it('verifies the code once entered', async () => {
    mockSendOtpCode.mockResolvedValue(undefined);
    mockVerifyOtpCode.mockResolvedValue(undefined);
    const { getByTestId } = render(<LoginScreen />);

    fireEvent.press(getByTestId('login-submit'));
    await waitFor(() => expect(getByTestId('login-code-input')).toBeTruthy());

    fireEvent.changeText(getByTestId('login-code-input'), '123456');
    fireEvent.press(getByTestId('login-verify-code'));

    await waitFor(() => expect(mockVerifyOtpCode).toHaveBeenCalledWith('', '123456'));
  });

  it('resends the code from the code step', async () => {
    mockSendOtpCode.mockResolvedValue(undefined);
    const { getByTestId } = render(<LoginScreen />);

    fireEvent.press(getByTestId('login-submit'));
    await waitFor(() => expect(getByTestId('login-code-input')).toBeTruthy());

    fireEvent.press(getByTestId('login-resend-code'));

    await waitFor(() => expect(mockSendOtpCode).toHaveBeenCalledTimes(2));
  });

  it('goes back to the email step so a typo can be corrected before verifying', async () => {
    mockSendOtpCode.mockResolvedValue(undefined);
    const { getByTestId, queryByTestId } = render(<LoginScreen />);

    fireEvent.press(getByTestId('login-submit'));
    await waitFor(() => expect(getByTestId('login-code-input')).toBeTruthy());
    fireEvent.changeText(getByTestId('login-code-input'), '123456');

    fireEvent.press(getByTestId('login-change-email'));

    // Back on the email step, with the stale code discarded.
    await waitFor(() => expect(getByTestId('login-submit')).toBeTruthy());
    expect(queryByTestId('login-code-input')).toBeNull();
    fireEvent.press(getByTestId('login-submit'));
    await waitFor(() => expect(getByTestId('login-code-input')).toBeTruthy());
    expect(getByTestId('login-code-input').props.value).toBe('');
  });

  it('calls signInWithGoogle from the Google button', async () => {
    mockSignInWithGoogle.mockResolvedValue(undefined);
    const { getByTestId } = render(<LoginScreen />);

    fireEvent.press(getByTestId('login-google-button'));

    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));
  });
});
