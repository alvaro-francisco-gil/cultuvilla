import { render, fireEvent } from '@testing-library/react-native';
import { AttendeeSheet } from '../AttendeeSheet';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));

const baseProps = {
  visible: true,
  telephoneRequired: false,
  busy: false,
  onClose: jest.fn(),
  onCreateNew: jest.fn(),
  onConfirm: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('AttendeeSheet', () => {
  it('renders a row per persona and a status badge for those already registered', () => {
    const { getByText } = render(
      <AttendeeSheet
        {...baseProps}
        attendees={[
          { id: 'self', name: 'Ana', status: 'confirmed' },
          { id: 'dep1', name: 'Hijo' },
        ]}
      />,
    );
    expect(getByText('Ana')).toBeTruthy();
    expect(getByText('Hijo')).toBeTruthy();
    // Registered self shows the confirmed badge; the unregistered dependent does not.
    expect(getByText('event.register.signedUp')).toBeTruthy();
  });

  it('defaults selection to the registered personas and reports added ones on confirm', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <AttendeeSheet
        {...baseProps}
        onConfirm={onConfirm}
        attendees={[
          { id: 'self', name: 'Ana', status: 'confirmed' },
          { id: 'dep1', name: 'Hijo' },
        ]}
      />,
    );
    fireEvent.press(getByTestId('attendee-row-dep1')); // tick the dependent
    fireEvent.press(getByTestId('attendee-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(['self', 'dep1'], undefined);
  });

  it('gates confirm behind a shared phone on telephoneRequired events with a new attendee', () => {
    const onConfirm = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <AttendeeSheet
        {...baseProps}
        telephoneRequired
        onConfirm={onConfirm}
        attendees={[{ id: 'self', name: 'Ana' }]}
      />,
    );
    // No new attendee selected yet → no phone field.
    expect(queryByTestId('attendee-phone')).toBeNull();

    fireEvent.press(getByTestId('attendee-row-self')); // selecting a not-yet-registered persona
    const phone = getByTestId('attendee-phone');

    // Confirm blocked until the phone is filled.
    fireEvent.press(getByTestId('attendee-confirm'));
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.changeText(phone, '600111222');
    fireEvent.press(getByTestId('attendee-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(['self'], '600111222');
  });

  it('routes to persona creation via onCreateNew', () => {
    const onCreateNew = jest.fn();
    const { getByTestId } = render(
      <AttendeeSheet {...baseProps} onCreateNew={onCreateNew} attendees={[{ id: 'self', name: 'Ana' }]} />,
    );
    fireEvent.press(getByTestId('attendee-create'));
    expect(onCreateNew).toHaveBeenCalled();
  });

  it('pre-selects personas passed in autoSelectIds (e.g. a freshly created dependent)', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <AttendeeSheet
        {...baseProps}
        onConfirm={onConfirm}
        autoSelectIds={['dep1']}
        attendees={[
          { id: 'self', name: 'Ana', status: 'confirmed' },
          { id: 'dep1', name: 'Hijo' },
        ]}
      />,
    );
    fireEvent.press(getByTestId('attendee-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(['self', 'dep1'], undefined);
  });
});
