import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { EventOrganizeConsole } from './EventOrganizeConsole';
import {
  getEventRegistrations, setRegistrationCheckIn, cancelRegistration, addWalkInRegistration, getRegistrationPhone,
} from '@cultuvilla/shared/services/registrationService';
import { updateEventStatus } from '@cultuvilla/shared/services/eventService';

jest.mock('@cultuvilla/shared/services/registrationService', () => ({
  getEventRegistrations: jest.fn(),
  setRegistrationCheckIn: jest.fn().mockResolvedValue(undefined),
  cancelRegistration: jest.fn().mockResolvedValue(undefined),
  addWalkInRegistration: jest.fn().mockResolvedValue({ id: 'w1', status: 'confirmed', position: 2 }),
  getRegistrationPhone: jest.fn().mockResolvedValue(null),
}));
jest.mock('@cultuvilla/shared/services/eventService', () => ({
  updateEvent: jest.fn().mockResolvedValue(undefined),
  updateEventStatus: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));

const event = {
  id: 'e1', title: 'Fiesta', description: 'd', maxAttendees: 10, status: 'published',
  organizerUserIds: ['uid-1'], organizerOrgIds: [], municipalityId: 'm1',
} as never;

const mockGet = getEventRegistrations as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue([
    { id: 'r1', name: 'Alice', status: 'confirmed', position: 1, userId: 'a', personId: 'p', registeredAt: new Date(), checkedInAt: null },
  ]);
});

describe('<EventOrganizeConsole>', () => {
  it('renders the roster', async () => {
    const { findByText } = render(<EventOrganizeConsole event={event} />);
    expect(await findByText('Alice')).toBeTruthy();
  });

  it('checks in an attendee', async () => {
    const { findByTestId } = render(<EventOrganizeConsole event={event} />);
    fireEvent.press(await findByTestId('checkin-r1'));
    await waitFor(() => expect(setRegistrationCheckIn).toHaveBeenCalledWith('e1', 'r1', true));
  });

  it('removes a registration', async () => {
    const { findByTestId } = render(<EventOrganizeConsole event={event} />);
    fireEvent.press(await findByTestId('remove-r1'));
    await waitFor(() => expect(cancelRegistration).toHaveBeenCalledWith('e1', 'r1'));
  });

  it('adds a walk-in', async () => {
    const { getByTestId } = render(<EventOrganizeConsole event={event} />);
    fireEvent.changeText(getByTestId('walkin-name'), 'Bob');
    fireEvent.press(getByTestId('walkin-submit'));
    await waitFor(() => expect(addWalkInRegistration).toHaveBeenCalledWith('e1', 'Bob', undefined));
  });

  it('cancels the event', async () => {
    const { getByTestId } = render(<EventOrganizeConsole event={event} />);
    fireEvent.press(getByTestId('cancel-event'));
    await waitFor(() => expect(updateEventStatus).toHaveBeenCalledWith('e1', 'cancelled'));
  });
});
