import { render, fireEvent } from '@testing-library/react-native';
import { I18nProvider } from '../../../lib/i18n';
import { GoogleButton } from '../GoogleButton';

describe('<GoogleButton>', () => {
  it('renders the default label and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <I18nProvider>
        <GoogleButton onPress={onPress} testID="g" />
      </I18nProvider>,
    );
    expect(getByText('Continuar con Google')).toBeTruthy();
    fireEvent.press(getByText('Continuar con Google'));
    expect(onPress).toHaveBeenCalled();
  });

  it('shows the loading label and does not call onPress while loading', () => {
    const onPress = jest.fn();
    const { getByText, queryByText } = render(
      <I18nProvider>
        <GoogleButton onPress={onPress} loading testID="g" />
      </I18nProvider>,
    );
    expect(getByText('Conectando con Google…')).toBeTruthy();
    expect(queryByText('Continuar con Google')).toBeNull();
    fireEvent.press(getByText('Conectando con Google…'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
