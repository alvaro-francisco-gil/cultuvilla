import { render, fireEvent } from '@testing-library/react-native';
import { DateField } from '../DateField';

describe('DateField (Year / Month / Day)', () => {
  it('shows Año / Mes / Día placeholders when no value', () => {
    const { getByText } = render(
      <DateField label="Cumple" value={null} onChange={() => {}} />,
    );
    expect(getByText('Año')).toBeTruthy();
    expect(getByText('Mes')).toBeTruthy();
    expect(getByText('Día')).toBeTruthy();
  });

  it('shows the parts of the date when a value is provided', () => {
    const { getByText } = render(
      <DateField label="Cumple" value={new Date(1990, 4, 5)} onChange={() => {}} />,
    );
    expect(getByText('1990')).toBeTruthy();
    // Segment shows the short month name to fit on one line.
    expect(getByText('May')).toBeTruthy();
    expect(getByText('5')).toBeTruthy();
  });

  it('emits the composed Date when all three segments are picked', () => {
    const onChange = jest.fn();
    const { getByTestId, getAllByText } = render(
      <DateField label="Cumple" value={null} onChange={onChange} testID="cumple" />,
    );

    fireEvent.press(getByTestId('cumple-year'));
    fireEvent.press(getAllByText('1990')[0]);
    fireEvent.press(getByTestId('cumple-month'));
    fireEvent.press(getAllByText('Mayo')[0]);
    fireEvent.press(getByTestId('cumple-day'));
    // Use day 5 — within FlatList's default initialNumToRender window.
    const dayMatches = getAllByText('5');
    fireEvent.press(dayMatches[dayMatches.length - 1]);

    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Date;
    expect(last.getFullYear()).toBe(1990);
    expect(last.getMonth()).toBe(4);
    expect(last.getDate()).toBe(5);
  });
});
