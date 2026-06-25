// apps/mobile/components/feature/__tests__/RegisterFab.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { RegisterFab } from '../RegisterFab';
import {
  getUserRegistrations,
  registerToEvent,
  cancelRegistration,
} from '@cultuvilla/shared/services/registrationService';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../lib/dialogs', () => ({
  // Auto-confirm so the cancel path runs through to cancelRegistration.
  showConfirm: (_t: string, _m: string, onConfirm: () => void) => onConfirm(),
  showAlert: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/registrationService', () => ({
  getUserRegistrations: jest.fn(),
  registerToEvent: jest.fn(),
  cancelRegistration: jest.fn(),
}));

const mockGetUserRegistrations = getUserRegistrations as jest.Mock;
const mockRegisterToEvent = registerToEvent as jest.Mock;
const mockCancelRegistration = cancelRegistration as jest.Mock;

const baseProps = {
  eventId: 'e1',
  userId: 'u1',
  personId: 'p1',
  name: 'Ana',
  telephoneRequired: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserRegistrations.mockResolvedValue([]);
});

describe('RegisterFab', () => {
  it('shows the sign-up CTA and registers (no phone) when the user is not signed up', async () => {
    mockRegisterToEvent.mockResolvedValue([{ id: 'r9', status: 'confirmed', position: 1, isMember: true }]);
    const { getByTestId, getByText } = render(<RegisterFab {...baseProps} />);

    await waitFor(() => expect(getByText('event.register.cta')).toBeTruthy());

    fireEvent.press(getByTestId('register-fab'));

    await waitFor(() => expect(getByText('event.register.signedUp')).toBeTruthy());
    expect(mockRegisterToEvent).toHaveBeenCalledWith('e1', [{ personId: 'p1', name: 'Ana' }]);
  });

  it('shows the confirmed state and cancels (with confirm dialog) when tapped', async () => {
    mockGetUserRegistrations.mockResolvedValue([{ id: 'r1', status: 'confirmed', position: 1 }]);
    mockCancelRegistration.mockResolvedValue(undefined);
    const { getByTestId, getByText } = render(<RegisterFab {...baseProps} />);

    await waitFor(() => expect(getByText('event.register.signedUp')).toBeTruthy());

    fireEvent.press(getByTestId('register-fab'));

    await waitFor(() => expect(getByText('event.register.cta')).toBeTruthy());
    expect(mockCancelRegistration).toHaveBeenCalledWith('e1', 'r1');
  });

  it('shows the waitlisted state when the existing registration is waitlisted', async () => {
    mockGetUserRegistrations.mockResolvedValue([{ id: 'r2', status: 'waitlisted', position: 5 }]);
    const { getByText } = render(<RegisterFab {...baseProps} />);

    await waitFor(() => expect(getByText('event.register.waitlisted')).toBeTruthy());
  });

  it('prompts for a phone before registering on telephoneRequired events', async () => {
    mockRegisterToEvent.mockResolvedValue([{ id: 'r9', status: 'confirmed', position: 1, isMember: true }]);
    const { getByTestId, getByText, queryByTestId } = render(
      <RegisterFab {...baseProps} telephoneRequired />,
    );

    await waitFor(() => expect(getByText('event.register.cta')).toBeTruthy());

    // No phone prompt until the FAB is tapped.
    expect(queryByTestId('register-fab-phone')).toBeNull();
    fireEvent.press(getByTestId('register-fab'));

    // Tapping opens the phone prompt instead of registering immediately.
    const phoneInput = getByTestId('register-fab-phone');
    expect(mockRegisterToEvent).not.toHaveBeenCalled();

    fireEvent.changeText(phoneInput, '600111222');
    fireEvent.press(getByTestId('register-fab-phone-submit'));

    await waitFor(() =>
      expect(mockRegisterToEvent).toHaveBeenCalledWith('e1', [
        { personId: 'p1', name: 'Ana', phone: '600111222' },
      ]),
    );
  });
});
