import { render, fireEvent } from '@testing-library/react-native';
import { DateTimeField } from '../DateTimeField';

it('emits a date+time from the two-button row', () => {
  const onChange = jest.fn();
  const { getByTestId } = render(
    <DateTimeField label="Inicio" value={new Date(2026, 6, 1, 9, 0)} onChange={onChange} testID="dt" />,
  );
  fireEvent.press(getByTestId('dt-date'));
  fireEvent.press(getByTestId('dt-date-calendar-day-2026-07-05'));
  const d = onChange.mock.calls.at(-1)![0] as Date;
  expect(d.getDate()).toBe(5);
  expect(d.getHours()).toBe(9); // time preserved
});
