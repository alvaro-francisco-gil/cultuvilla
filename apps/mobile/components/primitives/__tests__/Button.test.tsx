import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('<Button>', () => {
  it('renders children and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button onPress={onPress}>Save</Button>);
    fireEvent.press(getByText('Save'));
    expect(onPress).toHaveBeenCalled();
  });

  it('ignores press when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button onPress={onPress} disabled>Save</Button>);
    fireEvent.press(getByText('Save'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows spinner when loading', () => {
    const { getByTestId } = render(
      <Button onPress={() => {}} loading testID="b">x</Button>
    );
    expect(getByTestId('b-spinner')).toBeTruthy();
  });
});
