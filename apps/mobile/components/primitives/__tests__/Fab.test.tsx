import { render, fireEvent } from '@testing-library/react-native';
import { Fab } from '../Fab';

describe('<Fab>', () => {
  it('renders with testID', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<Fab onPress={onPress} testID="fab" />);
    expect(getByTestId('fab')).toBeTruthy();
  });

  it('fires onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<Fab onPress={onPress} testID="fab" />);
    fireEvent.press(getByTestId('fab'));
    expect(onPress).toHaveBeenCalled();
  });

  it('renders default "+" label', () => {
    const { getByText } = render(<Fab onPress={jest.fn()} />);
    expect(getByText('+')).toBeTruthy();
  });

  it('renders a custom label', () => {
    const { getByText } = render(<Fab onPress={jest.fn()} label="✎" />);
    expect(getByText('✎')).toBeTruthy();
  });
});
