import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Pressable } from '../Pressable';

describe('<Pressable>', () => {
  it('fires onPress', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <Pressable onPress={onPress} testID="p"><Text>tap</Text></Pressable>
    );
    fireEvent.press(getByTestId('p'));
    expect(onPress).toHaveBeenCalled();
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <Pressable onPress={onPress} disabled testID="p2"><Text>tap</Text></Pressable>
    );
    fireEvent.press(getByTestId('p2'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
