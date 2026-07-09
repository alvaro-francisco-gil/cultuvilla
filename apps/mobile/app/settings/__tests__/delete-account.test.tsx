import { render, fireEvent, waitFor } from '@testing-library/react-native';
import DeleteAccountScreen from '../delete-account';

jest.mock('../../../lib/i18n', () => ({
  useT: () => ({
    locale: 'es',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));
jest.mock('../../../components/layout/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockSignOut = jest.fn();
const mockUseAuth = jest.fn();
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockCheckAccountDeletable = jest.fn();
const mockDeleteAccount = jest.fn();
jest.mock('@cultuvilla/shared/services/accountService', () => ({
  checkAccountDeletable: (...args: unknown[]) => mockCheckAccountDeletable(...args),
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
}));

describe('DeleteAccountScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ signOut: mockSignOut });
  });

  it('disables the delete button and lists blockers when the account has sole-admin blockers', async () => {
    mockCheckAccountDeletable.mockResolvedValue({
      blockers: [{ scopeType: 'village', scopeId: 'v1', name: 'Villa Ejemplo' }],
    });

    const { findByText } = render(<DeleteAccountScreen />);

    expect(await findByText('settings.deleteAccount.blockerIntro')).toBeTruthy();
    const blockerText = await findByText(/Villa Ejemplo/, { exact: false });
    expect(blockerText).toBeTruthy();
  });

  it('enables the delete button only once the confirm word is typed', async () => {
    mockCheckAccountDeletable.mockResolvedValue({ blockers: [] });

    const { findByText, getByLabelText, getByTestId } = render(<DeleteAccountScreen />);
    await findByText('settings.deleteAccount.warning');

    const submitButton = getByTestId('delete-account-submit');
    expect(submitButton.props.accessibilityState?.disabled ?? true).toBe(true);

    fireEvent.changeText(getByLabelText('settings.deleteAccount.confirmPrompt'), 'ELIMINAR');

    await waitFor(() => {
      expect(getByTestId('delete-account-submit').props.accessibilityState?.disabled).toBe(false);
    });
  });

  it('calls deleteAccount then signOut when confirmed', async () => {
    mockCheckAccountDeletable.mockResolvedValue({ blockers: [] });
    mockDeleteAccount.mockResolvedValue({ ok: true });

    const { findByText, getByLabelText, getByTestId } = render(<DeleteAccountScreen />);
    await findByText('settings.deleteAccount.warning');

    fireEvent.changeText(getByLabelText('settings.deleteAccount.confirmPrompt'), 'ELIMINAR');
    const submitButton = getByTestId('delete-account-submit');
    fireEvent.press(submitButton);

    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalled());
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });
});
