import { render, fireEvent } from '@testing-library/react-native';
import { I18nProvider } from '../../../lib/i18n';
import { ForgotPasswordLink } from '../ForgotPasswordLink';

describe('<ForgotPasswordLink>', () => {
  it('renders the localized label and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <I18nProvider>
        <ForgotPasswordLink onPress={onPress} />
      </I18nProvider>,
    );
    const link = getByText('¿Olvidaste tu contraseña?');
    expect(link).toBeTruthy();
    fireEvent.press(link);
    expect(onPress).toHaveBeenCalled();
  });
});
