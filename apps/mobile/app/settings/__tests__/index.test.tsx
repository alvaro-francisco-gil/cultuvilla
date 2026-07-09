import { render, fireEvent } from '@testing-library/react-native';
import SettingsScreen from '../index';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: jest.fn() },
}));
jest.mock('../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (key: string) => key }),
}));
jest.mock('../../../components/layout/ScreenHeader', () => ({ ScreenHeader: () => null }));

const mockUseAuth = jest.fn();
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      profile: { email: 'ana@test.com', displayName: 'Ana Gil' },
      emailProvider: 'password',
    });
  });

  it('renders the read-only email and displayName', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Ana Gil')).toBeTruthy();
    expect(getByText('ana@test.com')).toBeTruthy();
  });

  it('shows the Cuenta section with two rows', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('settings.section.account')).toBeTruthy();
    expect(getByText('settings.changeEmail.label')).toBeTruthy();
    expect(getByText('settings.deleteAccount.label')).toBeTruthy();
  });

  it('navigates to /settings/change-email when tapping "Cambiar correo"', () => {
    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('settings.changeEmail.label'));
    expect(mockPush).toHaveBeenCalledWith('/settings/change-email');
  });

  it('navigates to /settings/delete-account when tapping "Eliminar cuenta"', () => {
    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('settings.deleteAccount.label'));
    expect(mockPush).toHaveBeenCalledWith('/settings/delete-account');
  });

  it('disables the change-email row and shows the hint for Google-only accounts', () => {
    mockUseAuth.mockReturnValue({
      profile: { email: 'ana@test.com', displayName: 'Ana Gil' },
      emailProvider: 'google.com',
    });
    const { getByText, queryByText } = render(<SettingsScreen />);
    expect(getByText('settings.changeEmail.googleDisabledHint')).toBeTruthy();
    mockPush.mockClear();
    fireEvent.press(getByText('settings.changeEmail.label'));
    expect(mockPush).not.toHaveBeenCalled();
    expect(queryByText('settings.changeEmail.googleDisabledHint')).toBeTruthy();
  });
});
