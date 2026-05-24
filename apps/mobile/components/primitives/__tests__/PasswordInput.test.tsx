import { render, fireEvent } from '@testing-library/react-native';
import { PasswordInput } from '../PasswordInput';

describe('PasswordInput', () => {
  it('toggles secure entry when the reveal button is pressed', () => {
    const { getByTestId } = render(
      <PasswordInput label="Contraseña" value="hunter2" onChangeText={() => {}} testID="pw" />,
    );
    const input = getByTestId('pw-input');
    expect(input.props.secureTextEntry).toBe(true);

    fireEvent.press(getByTestId('pw-toggle'));
    expect(input.props.secureTextEntry).toBe(false);

    fireEvent.press(getByTestId('pw-toggle'));
    expect(input.props.secureTextEntry).toBe(true);
  });
});
