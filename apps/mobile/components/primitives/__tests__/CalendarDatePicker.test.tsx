import { render, fireEvent } from '@testing-library/react-native';
import { CalendarDatePicker } from '../CalendarDatePicker';

describe('CalendarDatePicker', () => {
  it('emits the tapped day', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <CalendarDatePicker value={new Date(2026, 6, 1)} onChange={onChange} testID="cal" />,
    );
    fireEvent.press(getByTestId('cal-day-2026-07-15'));
    const picked = onChange.mock.calls.at(-1)![0] as Date;
    expect(picked.getFullYear()).toBe(2026);
    expect(picked.getMonth()).toBe(6);
    expect(picked.getDate()).toBe(15);
  });

  it('navigates to the next month via the chevron', () => {
    const { getByTestId, queryByTestId } = render(
      <CalendarDatePicker value={new Date(2026, 6, 1)} onChange={() => {}} testID="cal" />,
    );
    expect(queryByTestId('cal-day-2026-08-10')).toBeNull();
    fireEvent.press(getByTestId('cal-next'));
    expect(getByTestId('cal-day-2026-08-10')).toBeTruthy();
  });

  it('jumps to a far-past month/year from the title', () => {
    const { getByTestId } = render(
      <CalendarDatePicker
        value={new Date(2026, 6, 1)}
        onChange={() => {}}
        minDate={new Date(1900, 0, 1)}
        maxDate={new Date(2026, 6, 10)}
        testID="cal"
      />,
    );
    fireEvent.press(getByTestId('cal-title'));
    fireEvent.press(getByTestId('cal-year-1974'));
    fireEvent.press(getByTestId('cal-month-2')); // March (0-based)
    expect(getByTestId('cal-day-1974-03-05')).toBeTruthy();
  });

  it('does not emit for a disabled (out-of-range) day', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <CalendarDatePicker
        value={new Date(2026, 6, 10)}
        onChange={onChange}
        minDate={new Date(2026, 6, 10)}
        testID="cal"
      />,
    );
    fireEvent.press(getByTestId('cal-day-2026-07-05')); // before min
    expect(onChange).not.toHaveBeenCalled();
  });
});
