import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { EventAttendees } from '../EventAttendees';
import {
  getEventRegistrations,
  getRegistrationPhone,
  cancelRegistration,
  setRegistrationPaid,
} from '@cultuvilla/shared/services/registrationService';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('../../../lib/dialogs', () => ({
  showConfirm: (_t: string, _m: string, onConfirm: () => void) => onConfirm(),
  showAlert: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/registrationService', () => ({
  getEventRegistrations: jest.fn(),
  getRegistrationPhone: jest.fn(),
  cancelRegistration: jest.fn().mockResolvedValue(undefined),
  setRegistrationPaid: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/services/personService', () => ({
  getPerson: jest.fn().mockResolvedValue({ id: 'p1', photoURL: null }),
}));

const mockGet = getEventRegistrations as jest.Mock;
const mockPhone = getRegistrationPhone as jest.Mock;
const mockCancel = cancelRegistration as jest.Mock;

describe('EventAttendees', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a call action that reveals the number in a dialog when telephone was required', async () => {
    mockGet.mockResolvedValue([{ id: 'r1', personId: 'p1', name: 'Ana', status: 'confirmed' }]);
    mockPhone.mockResolvedValue('600111222');
    const { getByText, getByTestId, queryByText } = render(
      <EventAttendees eventId="e1" telephoneRequired requiresPayment={false} />,
    );
    await waitFor(() => getByTestId('call-attendee-r1'));
    // Number is not shown inline until the call dialog is opened.
    expect(queryByText('600111222')).toBeNull();
    fireEvent.press(getByTestId('call-attendee-r1'));
    getByText('600111222');
  });

  it('shows no call action when telephone was not required', async () => {
    mockGet.mockResolvedValue([{ id: 'r1', personId: 'p1', name: 'Ana', status: 'confirmed' }]);
    const { getByText, queryByTestId } = render(
      <EventAttendees eventId="e1" telephoneRequired={false} requiresPayment={false} />,
    );
    await waitFor(() => getByText('Ana'));
    expect(mockPhone).not.toHaveBeenCalled();
    expect(queryByTestId('call-attendee-r1')).toBeNull();
  });

  it('removes an attendee then reloads', async () => {
    mockGet.mockResolvedValue([{ id: 'r1', personId: 'p1', name: 'Ana', status: 'confirmed' }]);
    const { getByTestId } = render(
      <EventAttendees eventId="e1" telephoneRequired={false} requiresPayment={false} />,
    );
    await waitFor(() => getByTestId('remove-attendee-r1'));
    fireEvent.press(getByTestId('remove-attendee-r1'));
    await waitFor(() => expect(mockCancel).toHaveBeenCalledWith('e1', 'r1'));
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('splits confirmed attendees from a separate waiting-list section', async () => {
    mockGet.mockResolvedValue([
      { id: 'r1', personId: 'p1', name: 'Ana', status: 'confirmed' },
      { id: 'r2', personId: 'p2', name: 'Luis', status: 'waitlisted' },
    ]);
    const { getByText, getByTestId } = render(
      <EventAttendees eventId="e1" telephoneRequired={false} requiresPayment={false} />,
    );
    // The waitlist heading only appears when someone is waitlisted.
    await waitFor(() => getByText('event.waitlist (1)'));
    getByText('event.attendees (1)');
    getByText('Ana');
    getByText('Luis');
    // Both sections expose their own remove action.
    getByTestId('remove-attendee-r1');
    getByTestId('remove-attendee-r2');
  });

  it('hides the waiting-list section when nobody is waitlisted', async () => {
    mockGet.mockResolvedValue([{ id: 'r1', personId: 'p1', name: 'Ana', status: 'confirmed' }]);
    const { getByText, queryByText } = render(
      <EventAttendees eventId="e1" telephoneRequired={false} requiresPayment={false} />,
    );
    await waitFor(() => getByText('Ana'));
    expect(queryByText('event.waitlist (0)')).toBeNull();
  });

  it('toggles setRegistrationPaid when the paid checkbox is pressed (requiresPayment)', async () => {
    mockGet.mockResolvedValue([{ id: 'r1', personId: 'p1', name: 'Ana', status: 'confirmed', paidAt: null }]);
    const { getByTestId } = render(
      <EventAttendees eventId="e1" telephoneRequired={false} requiresPayment />,
    );
    await waitFor(() => getByTestId('paid-attendee-r1'));
    fireEvent.press(getByTestId('paid-attendee-r1'));
    await waitFor(() => expect(setRegistrationPaid).toHaveBeenCalledWith('e1', 'r1', true));
  });

  it('hides the paid checkbox when requiresPayment is false', async () => {
    mockGet.mockResolvedValue([{ id: 'r1', personId: 'p1', name: 'Ana', status: 'confirmed', paidAt: null }]);
    const { queryByTestId, getByText } = render(
      <EventAttendees eventId="e1" telephoneRequired={false} requiresPayment={false} />,
    );
    await waitFor(() => getByText('Ana'));
    expect(queryByTestId('paid-attendee-r1')).toBeNull();
  });
});
