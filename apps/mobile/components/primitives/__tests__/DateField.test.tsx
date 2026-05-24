import { render } from '@testing-library/react-native';
import { DateField } from '../DateField';

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

describe('DateField', () => {
  it('shows the placeholder when no value', () => {
    const { getByText } = render(
      <DateField label="Cumple" value={null} onChange={() => {}} placeholder="DD/MM/AAAA" />,
    );
    expect(getByText('DD/MM/AAAA')).toBeTruthy();
  });

  it('shows the formatted date when value provided', () => {
    const { getByText } = render(
      <DateField label="Cumple" value={new Date(1990, 4, 17)} onChange={() => {}} />,
    );
    expect(getByText('17/05/1990')).toBeTruthy();
  });

  it('exposes a trigger testID', () => {
    const { getByTestId } = render(
      <DateField label="Cumple" value={null} onChange={() => {}} testID="cumple" />,
    );
    expect(getByTestId('cumple-trigger')).toBeTruthy();
  });
});
