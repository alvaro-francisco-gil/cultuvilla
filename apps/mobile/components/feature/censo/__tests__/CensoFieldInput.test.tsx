import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CensoFieldInput } from '../CensoFieldInput';

jest.mock('../../../../lib/i18n', () => ({
  useT: () => ({
    locale: 'es',
    t: (k: string) => {
      const translations: Record<string, string> = {
        'censo.builder.deletedEntity': '(eliminado)',
      };
      return translations[k] ?? k;
    },
  }),
}));

it('renders a numeric input and emits a number', () => {
  const onChange = jest.fn();
  const { getByLabelText } = render(
    <CensoFieldInput field={{ source: 'custom', key: 'n', label: 'Edad', type: 'number', required: false }} value={undefined} onChange={onChange} />,
  );
  fireEvent.changeText(getByLabelText('Edad'), '42');
  expect(onChange).toHaveBeenCalledWith(42);
});

it('appends a deleted-entity option for a stored id not in current options', () => {
  const onChange = jest.fn();
  const { getByText } = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <CensoFieldInput
        field={{ source: 'custom', key: 'b', label: 'Barrio', type: 'select', optionsSource: 'barrios', required: false }}
        value="gone-id"
        onChange={onChange}
        entityOptions={[{ value: 'x', label: 'Centro' }]}
      />
    </SafeAreaProvider>,
  );
  expect(getByText('(eliminado)')).toBeTruthy();
  // Verify the ghost chip is non-interactive (disabled)
  fireEvent.press(getByText('(eliminado)'));
  expect(onChange).not.toHaveBeenCalled();
});
