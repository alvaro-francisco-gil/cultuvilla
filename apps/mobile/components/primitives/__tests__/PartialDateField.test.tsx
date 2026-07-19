import { fireEvent, render } from '@testing-library/react-native';
import { PartialDateField } from '../PartialDateField';

jest.mock('../../../lib/i18n', () => ({
  useT: () => ({
    locale: 'es',
    t: (key: string) =>
      ({
        'partialDate.year': 'Año',
        'partialDate.month': 'Mes',
        'partialDate.day': 'Día',
        'partialDate.clear': 'Sin fecha',
        'common.cancel': 'Cancelar',
      })[key] ?? key,
  }),
}));

describe('PartialDateField', () => {
  it('renders separate year, month, and day selectors', () => {
    const { getByTestId } = render(
      <PartialDateField label="Fecha" value={null} onChange={() => {}} testID="d" />,
    );
    expect(getByTestId('d-year')).toBeTruthy();
    expect(getByTestId('d-month')).toBeTruthy();
    expect(getByTestId('d-day')).toBeTruthy();
  });

  it('emits a year-only partial date (month is enough to omit)', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <PartialDateField label="Fecha" value={null} onChange={onChange} maxYear={2026} testID="d" />,
    );
    fireEvent.press(getByTestId('d-year'));
    fireEvent.press(getByTestId('d-year-option-1990'));
    expect(onChange).toHaveBeenLastCalledWith({ year: 1990, month: null, day: null });
  });

  it('emits a 1-based month when year and month are set', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <PartialDateField label="Fecha" value={null} onChange={onChange} maxYear={2026} testID="d" />,
    );
    fireEvent.press(getByTestId('d-year'));
    fireEvent.press(getByTestId('d-year-option-1990'));
    fireEvent.press(getByTestId('d-month'));
    fireEvent.press(getByTestId('d-month-option-4')); // internal 0-based May
    expect(onChange).toHaveBeenLastCalledWith({ year: 1990, month: 5, day: null });
  });

  it('clears to null when "Sin fecha" is pressed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <PartialDateField
        label="Fecha"
        value={{ year: 1990, month: 5, day: null }}
        onChange={onChange}
        testID="d"
      />,
    );
    fireEvent.press(getByTestId('d-clear'));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
