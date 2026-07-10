import { render, fireEvent } from '@testing-library/react-native';
import { TimePicker } from '../TimePicker';

describe('TimePicker', () => {
  it('emits hour change preserving date', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <TimePicker value={new Date(2026, 6, 1, 9, 30)} onChange={onChange} testID="t" />,
    );
    fireEvent.press(getByTestId('t-hour-14'));
    const d = onChange.mock.calls.at(-1)![0] as Date;
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
    expect(d.getDate()).toBe(1);
  });

  it('emits minute change stepped by minuteStep', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <TimePicker value={new Date(2026, 6, 1, 9, 0)} onChange={onChange} minuteStep={15} testID="t" />,
    );
    fireEvent.press(getByTestId('t-minute-45'));
    expect((onChange.mock.calls.at(-1)![0] as Date).getMinutes()).toBe(45);
  });
});
