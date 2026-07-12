import { render, fireEvent } from '@testing-library/react-native';
import { DEFAULT_PHONE_COUNTRY } from '@cultuvilla/shared/utils';
import { PhoneField } from '../PhoneField';

const baseProps = {
  value: '',
  onChangeText: jest.fn(),
  country: DEFAULT_PHONE_COUNTRY,
  onCountryChange: jest.fn(),
  searchPlaceholder: 'Buscar país',
  testID: 'phone',
};

beforeEach(() => jest.clearAllMocks());

describe('PhoneField country picker', () => {
  it('opens the picker and lists many countries', () => {
    const { getByTestId, queryByTestId } = render(<PhoneField {...baseProps} />);
    // Closed by default.
    expect(queryByTestId('phone-option-FR')).toBeNull();

    fireEvent.press(getByTestId('phone-prefix'));
    expect(getByTestId('phone-option-FR')).toBeTruthy();
    expect(getByTestId('phone-option-DE')).toBeTruthy();
    expect(getByTestId('phone-option-US')).toBeTruthy();
  });

  it('filters the list by an accent-insensitive name search', () => {
    const { getByTestId, queryByTestId } = render(<PhoneField {...baseProps} />);
    fireEvent.press(getByTestId('phone-prefix'));

    // "peru" (no accent) should still match "Perú".
    fireEvent.changeText(getByTestId('phone-search'), 'peru');
    expect(getByTestId('phone-option-PE')).toBeTruthy();
    expect(queryByTestId('phone-option-DE')).toBeNull();
    expect(queryByTestId('phone-option-FR')).toBeNull();
  });

  it('filters by dial code too', () => {
    const { getByTestId, queryByTestId } = render(<PhoneField {...baseProps} />);
    fireEvent.press(getByTestId('phone-prefix'));

    fireEvent.changeText(getByTestId('phone-search'), '+33');
    expect(getByTestId('phone-option-FR')).toBeTruthy();
    expect(queryByTestId('phone-option-US')).toBeNull();
  });

  it('selects a country and closes the picker', () => {
    const onCountryChange = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <PhoneField {...baseProps} onCountryChange={onCountryChange} />,
    );
    fireEvent.press(getByTestId('phone-prefix'));
    fireEvent.press(getByTestId('phone-option-FR'));
    expect(onCountryChange).toHaveBeenCalledWith(expect.objectContaining({ code: 'FR', dialCode: '+33' }));
    // Picker closes after a pick.
    expect(queryByTestId('phone-option-FR')).toBeNull();
  });
});
