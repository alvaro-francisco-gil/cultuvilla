import { render, fireEvent } from '@testing-library/react-native';
import { Toggle } from '../Toggle';

describe('<Toggle>', () => {
  it('calls onValueChange with the toggled value', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<Toggle value={false} onValueChange={onChange} testID="t" />);
    fireEvent.press(getByTestId('t'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onValueChange with false when value is true', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<Toggle value={true} onValueChange={onChange} testID="t2" />);
    fireEvent.press(getByTestId('t2'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('renders label when provided', () => {
    const { getByText } = render(
      <Toggle value={false} onValueChange={jest.fn()} label="Acepto términos" />
    );
    expect(getByText('Acepto términos')).toBeTruthy();
  });
});
