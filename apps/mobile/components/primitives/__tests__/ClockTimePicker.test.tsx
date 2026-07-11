// apps/mobile/components/primitives/__tests__/ClockTimePicker.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ClockTimePicker } from '../ClockTimePicker';

describe('ClockTimePicker', () => {
  it('sets an outer-ring hour and advances to the minute page', () => {
    const onChange = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <ClockTimePicker value={new Date(2026, 6, 1, 9, 30)} onChange={onChange} testID="c" />,
    );
    fireEvent.press(getByTestId('c-hour-11'));
    const d = onChange.mock.calls.at(-1)![0] as Date;
    expect(d.getHours()).toBe(11);
    expect(d.getMinutes()).toBe(30); // preserved
    // now on the minute page: an hour tile is gone, a minute tile is present
    expect(queryByTestId('c-hour-11')).toBeNull();
    expect(getByTestId('c-minute-30')).toBeTruthy();
  });

  it('sets an inner-ring (24h) hour', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <ClockTimePicker value={new Date(2026, 6, 1, 9, 0)} onChange={onChange} testID="c" />,
    );
    fireEvent.press(getByTestId('c-hour-20'));
    expect((onChange.mock.calls.at(-1)![0] as Date).getHours()).toBe(20);
  });

  it('picks a minute preserving the hour', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <ClockTimePicker value={new Date(2026, 6, 1, 20, 0)} onChange={onChange} testID="c" />,
    );
    fireEvent.press(getByTestId('c-show-minute')); // jump straight to the minute page
    fireEvent.press(getByTestId('c-minute-45'));
    const d = onChange.mock.calls.at(-1)![0] as Date;
    expect(d.getMinutes()).toBe(45);
    expect(d.getHours()).toBe(20);
  });
});
