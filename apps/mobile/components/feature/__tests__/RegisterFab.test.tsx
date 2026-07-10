// apps/mobile/components/feature/__tests__/RegisterFab.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { RegisterFab } from '../RegisterFab';
import {
  getUserRegistrations,
  registerToEvent,
  cancelRegistration,
} from '@cultuvilla/shared/services/registrationService';
import { getPersonsByCreator } from '@cultuvilla/shared/services/personService';
import { observability } from '@cultuvilla/shared';

jest.mock('@cultuvilla/shared', () => ({
  ...jest.requireActual('@cultuvilla/shared'),
  observability: { trackEvent: jest.fn() },
}));
jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../../lib/dialogs', () => ({
  showConfirm: (_t: string, _m: string, onConfirm: () => void) => onConfirm(),
  showAlert: jest.fn(),
}));
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: { push: jest.fn() },
    // Run the focus callback once after mount, like a real initial focus.
    useFocusEffect: (cb: () => void) => React.useEffect(cb, []),
  };
});
jest.mock('@cultuvilla/shared/services/registrationService', () => ({
  getUserRegistrations: jest.fn(),
  registerToEvent: jest.fn(),
  cancelRegistration: jest.fn(),
}));
jest.mock('@cultuvilla/shared/services/personService', () => ({
  getPersonsByCreator: jest.fn(),
}));

const mockGetUserRegistrations = getUserRegistrations as jest.Mock;
const mockRegisterToEvent = registerToEvent as jest.Mock;
const mockCancelRegistration = cancelRegistration as jest.Mock;
const mockGetPersonsByCreator = getPersonsByCreator as jest.Mock;

const baseProps = {
  eventId: 'e1',
  userId: 'u1',
  personId: 'p1',
  name: 'Ana',
  telephoneRequired: false,
};

// A dependent persona created by the user (shape used by buildShortName).
const dep = {
  id: 'p2',
  givenName: 'Hijo',
  nickname: null,
  firstSurname: 'García',
  userId: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserRegistrations.mockResolvedValue([]);
  mockGetPersonsByCreator.mockResolvedValue([]);
  (observability.trackEvent as jest.Mock).mockClear();
});

describe('RegisterFab', () => {
  it('shows the sign-up CTA and opens the attendee sheet on tap', async () => {
    const { getByTestId, getByText } = render(<RegisterFab {...baseProps} />);
    await waitFor(() => expect(getByText('event.register.cta')).toBeTruthy());

    fireEvent.press(getByTestId('register-fab'));
    // Sheet opened with the caller's own persona as a row.
    expect(getByTestId('attendee-row-p1')).toBeTruthy();
  });

  it('shows a group count label when personas are already registered', async () => {
    mockGetUserRegistrations.mockResolvedValue([{ id: 'rA', personId: 'p1', status: 'confirmed' }]);
    const { getByText } = render(<RegisterFab {...baseProps} />);
    await waitFor(() => expect(getByText('event.register.signedUpCount')).toBeTruthy());
  });

  it('registers newly-selected personas (self + dependent) in one call', async () => {
    mockGetPersonsByCreator.mockResolvedValue([dep]);
    mockRegisterToEvent.mockResolvedValue([
      { id: 'rA', status: 'confirmed', position: 1, isMember: true },
      { id: 'rB', status: 'confirmed', position: 2, isMember: false },
    ]);
    const { getByTestId, getByText } = render(<RegisterFab {...baseProps} />);
    await waitFor(() => expect(getByText('event.register.cta')).toBeTruthy());

    fireEvent.press(getByTestId('register-fab'));
    fireEvent.press(getByTestId('attendee-row-p1'));
    fireEvent.press(getByTestId('attendee-row-p2'));
    fireEvent.press(getByTestId('attendee-confirm'));

    await waitFor(() =>
      expect(mockRegisterToEvent).toHaveBeenCalledWith('e1', [
        { personId: 'p1', name: 'Ana' },
        { personId: 'p2', name: 'Hijo García' },
      ]),
    );
    expect(observability.trackEvent).toHaveBeenCalledWith('event.signup.success', {});
  });

  // Reproduces production data: getPersonsByCreator returns the caller's OWN
  // persona (createdBy == uid, userId == uid) alongside the dependents
  // (createdBy == uid, userId == null). Only the own persona must be dropped;
  // every dependent must appear as a tickable row.
  it('lists every dependent when the creator query also returns the own persona', async () => {
    const self = { id: 'p1', givenName: 'Ana', nickname: null, firstSurname: 'López', userId: 'u1' };
    const dep1 = { id: 'p2', givenName: 'Jose', nickname: null, firstSurname: 'García', userId: null };
    const dep2 = { id: 'p3', givenName: 'Jos', nickname: null, firstSurname: 'Ruiz', userId: null };
    mockGetPersonsByCreator.mockResolvedValue([self, dep1, dep2]);
    const { getByTestId, getByText, queryByTestId } = render(<RegisterFab {...baseProps} />);
    await waitFor(() => expect(getByText('event.register.cta')).toBeTruthy());

    fireEvent.press(getByTestId('register-fab'));
    // Own persona rendered from props (once, not duplicated by the creator query).
    expect(getByTestId('attendee-row-p1')).toBeTruthy();
    // Both dependents must be listed.
    expect(getByTestId('attendee-row-p2')).toBeTruthy();
    expect(getByTestId('attendee-row-p3')).toBeTruthy();
    // And no second copy of the own persona.
    expect(queryByTestId('attendee-row-p1')).toBe(getByTestId('attendee-row-p1'));
  });

  // Regression: the two reads are independent, so a failing getUserRegistrations
  // (e.g. a missing Firestore index) must NOT blank the dependent list. Before
  // the fix they shared one Promise.all and a rejection hid every dependent.
  it('still lists dependents when getUserRegistrations rejects', async () => {
    mockGetUserRegistrations.mockRejectedValue(new Error('FAILED_PRECONDITION: missing index'));
    mockGetPersonsByCreator.mockResolvedValue([dep]);
    const { getByTestId, getByText } = render(<RegisterFab {...baseProps} />);
    await waitFor(() => expect(getByText('event.register.cta')).toBeTruthy());

    fireEvent.press(getByTestId('register-fab'));
    expect(getByTestId('attendee-row-p1')).toBeTruthy(); // self
    expect(getByTestId('attendee-row-p2')).toBeTruthy(); // dependent survives the reg failure
  });

  it('cancels a deselected registered persona after a single combined confirm', async () => {
    mockGetUserRegistrations.mockResolvedValue([
      { id: 'rA', personId: 'p1', status: 'confirmed' },
      { id: 'rB', personId: 'p2', status: 'confirmed' },
    ]);
    mockGetPersonsByCreator.mockResolvedValue([dep]);
    mockCancelRegistration.mockResolvedValue(undefined);
    const { getByTestId, getByText } = render(<RegisterFab {...baseProps} />);
    await waitFor(() => expect(getByText('event.register.signedUpCount')).toBeTruthy());

    fireEvent.press(getByTestId('register-fab'));
    fireEvent.press(getByTestId('attendee-row-p2')); // untick the dependent
    fireEvent.press(getByTestId('attendee-confirm'));

    await waitFor(() => expect(mockCancelRegistration).toHaveBeenCalledWith('e1', 'rB'));
  });
});
