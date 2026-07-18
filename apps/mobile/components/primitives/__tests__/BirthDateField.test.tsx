import { fireEvent, render } from '@testing-library/react-native';
import { BirthDateField } from '../BirthDateField';

jest.mock('../../../lib/i18n', () => ({
  useT: () => ({
    locale: 'es',
    t: (key: string) =>
      ({
        'profile.personForm.birthDatePicker.year': 'Año',
        'profile.personForm.birthDatePicker.month': 'Mes',
        'profile.personForm.birthDatePicker.day': 'Día',
        'common.cancel': 'Cancelar',
      })[key] ?? key,
  }),
}));

describe('BirthDateField', () => {
  it('renders separate year, month, and day selectors', () => {
    const { getByTestId, getByText } = render(
      <BirthDateField label="Fecha de nacimiento" value={null} onChange={() => {}} testID="birth" />,
    );

    expect(getByTestId('birth-year')).toBeTruthy();
    expect(getByTestId('birth-month')).toBeTruthy();
    expect(getByTestId('birth-day')).toBeTruthy();
    expect(getByText('Año')).toBeTruthy();
    expect(getByText('Mes')).toBeTruthy();
    expect(getByText('Día')).toBeTruthy();
  });

  it('emits a date after all three segments are selected', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <BirthDateField label="Fecha de nacimiento" value={null} onChange={onChange} testID="birth" />,
    );

    fireEvent.press(getByTestId('birth-year'));
    fireEvent.press(getByTestId('birth-year-option-1990'));
    fireEvent.press(getByTestId('birth-month'));
    fireEvent.press(getByTestId('birth-month-option-4'));
    fireEvent.press(getByTestId('birth-day'));
    fireEvent.press(getByTestId('birth-day-option-5'));

    expect(onChange).toHaveBeenLastCalledWith(new Date(1990, 4, 5));
  });

  it('shows full month names with readable inset in the month modal', () => {
    const { getAllByText, getByTestId, getByText } = render(
      <BirthDateField label="Fecha de nacimiento" value={null} onChange={() => {}} testID="birth" />,
    );

    fireEvent.press(getByTestId('birth-month'));

    expect(getByText('Mayo')).toBeTruthy();
    expect(getAllByText('Mes')[1]?.props.className).toContain('text-h2');
    expect(getAllByText('Mes')[1]?.props.className).toContain('text-success');
    expect(getByTestId('birth-month-option-4').props.className).toContain('px-6');
  });

  it('caps the available years at maximumDate', () => {
    const { getByTestId, queryByTestId } = render(
      <BirthDateField
        label="Fecha de nacimiento"
        value={null}
        onChange={() => {}}
        maximumDate={new Date(2012, 6, 18)}
        testID="birth"
      />,
    );

    fireEvent.press(getByTestId('birth-year'));
    expect(getByTestId('birth-year-option-2012')).toBeTruthy();
    expect(queryByTestId('birth-year-option-2013')).toBeNull();
  });
});
