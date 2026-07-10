import { render, fireEvent } from '@testing-library/react-native';
import { Checkbox } from '../Checkbox';

describe('<Checkbox>', () => {
  it('toggles the value on press', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <Checkbox value={false} onValueChange={onChange} testID="cb" />,
    );
    fireEvent.press(getByTestId('cb'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onValueChange with false when already checked', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <Checkbox value={true} onValueChange={onChange} testID="cb2" />,
    );
    fireEvent.press(getByTestId('cb2'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('reflects the checked state for accessibility', () => {
    const { getByTestId } = render(
      <Checkbox value onValueChange={jest.fn()} testID="cb3" />,
    );
    expect(getByTestId('cb3').props.accessibilityState.checked).toBe(true);
  });

  it('renders a string label', () => {
    const { getByText } = render(
      <Checkbox value={false} onValueChange={jest.fn()} label="Acepto" />,
    );
    expect(getByText('Acepto')).toBeTruthy();
  });
});
