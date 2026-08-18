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

  // Regression: a bad connection during signup used to render the SDK's own
  // developer string ("Firebase: Error (auth/network-request-failed).") straight
  // into the danger text under the input.
  describe('connection failures', () => {
    const networkError = () =>
      Object.assign(new Error('Firebase: Error (auth/network-request-failed).'), {
        code: 'auth/network-request-failed',
      });

    it('shows connection copy, not the raw Firebase string, when sending the code fails', async () => {
      mockSendOtpCode.mockRejectedValue(networkError());
      const { getByTestId, findByText, queryByText } = render(<LoginScreen />);

      fireEvent.press(getByTestId('login-submit'));

      await findByText(/conexión/i);
      expect(queryByText(/Firebase:/)).toBeNull();
      expect(queryByText(/auth\//)).toBeNull();
    });

    it('shows connection copy when verifying the code fails', async () => {
      mockSendOtpCode.mockResolvedValue(undefined);
      mockVerifyOtpCode.mockRejectedValue(networkError());
      const { getByTestId, findByText, queryByText } = render(<LoginScreen />);

      fireEvent.press(getByTestId('login-submit'));
      await waitFor(() => expect(getByTestId('login-code-input')).toBeTruthy());
      fireEvent.changeText(getByTestId('login-code-input'), '123456');
      fireEvent.press(getByTestId('login-verify-code'));

      await findByText(/conexión/i);
      expect(queryByText(/Firebase:/)).toBeNull();
    });

    it('shows connection copy when Google sign-in fails', async () => {
      mockSignInWithGoogle.mockRejectedValue(networkError());
      const { getByTestId, findByText, queryByText } = render(<LoginScreen />);

      fireEvent.press(getByTestId('login-google-button'));

      await findByText(/conexión/i);
      expect(queryByText(/Firebase:/)).toBeNull();
    });

    // The server's own Spanish copy is more useful than any generic message,
    // so the classifier must not swallow it.
    it('still shows the server message for a rejected code', async () => {
      mockSendOtpCode.mockResolvedValue(undefined);
      mockVerifyOtpCode.mockRejectedValue(
        Object.assign(new Error('Código incorrecto o caducado.'), {
          code: 'functions/invalid-argument',
        }),
      );
      const { getByTestId, findByText } = render(<LoginScreen />);

      fireEvent.press(getByTestId('login-submit'));
      await waitFor(() => expect(getByTestId('login-code-input')).toBeTruthy());
      fireEvent.press(getByTestId('login-verify-code'));

      await findByText('Código incorrecto o caducado.');
    });
  });

  it('calls signInWithGoogle from the Google button', async () => {
    mockSignInWithGoogle.mockResolvedValue(undefined);
    const { getByTestId } = render(<LoginScreen />);

    fireEvent.press(getByTestId('login-google-button'));

    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));
  });
});
