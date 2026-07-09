import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { EventAttendees } from '../EventAttendees';
import {
  getEventRegistrations,
  getRegistrationPhone,
  cancelRegistration,
} from '@cultuvilla/shared/services/registrationService';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('@cultuvilla/shared/services/registrationService', () => ({
  getEventRegistrations: jest.fn(),
  getRegistrationPhone: jest.fn(),
  cancelRegistration: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/services/personService', () => ({
  getPerson: jest.fn().mockResolvedValue({ id: 'p1', photoURL: null }),
}));

const mockGet = getEventRegistrations as jest.Mock;
const mockPhone = getRegistrationPhone as jest.Mock;
const mockCancel = cancelRegistration as jest.Mock;

describe('EventAttendees', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the roster with the phone column when telephone was required', async () => {
    mockGet.mockResolvedValue([{ id: 'r1', personId: 'p1', name: 'Ana' }]);
    mockPhone.mockResolvedValue('600111222');
    const { getByText } = render(<EventAttendees eventId="e1" telephoneRequired />);
    await waitFor(() => getByText('Ana'));
    getByText('600111222');
  });

  it('hides the phone column when telephone was not required', async () => {
    mockGet.mockResolvedValue([{ id: 'r1', personId: 'p1', name: 'Ana' }]);
    const { getByText, queryByText } = render(<EventAttendees eventId="e1" telephoneRequired={false} />);
    await waitFor(() => getByText('Ana'));
    expect(mockPhone).not.toHaveBeenCalled();
    expect(queryByText('600111222')).toBeNull();
  });

  it('removes an attendee then reloads', async () => {
    mockGet.mockResolvedValue([{ id: 'r1', personId: 'p1', name: 'Ana' }]);
    const { getByTestId } = render(<EventAttendees eventId="e1" telephoneRequired={false} />);
    await waitFor(() => getByTestId('remove-attendee-r1'));
    fireEvent.press(getByTestId('remove-attendee-r1'));
    await waitFor(() => expect(mockCancel).toHaveBeenCalledWith('e1', 'r1'));
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});
