import { render, fireEvent } from '@testing-library/react-native';
import { HeaderIconButton } from '../HeaderIconButton';

describe('HeaderIconButton', () => {
  it('renders with its accessibility label and fires onPress', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <HeaderIconButton icon="share-outline" onPress={onPress} accessibilityLabel="Compartir" />,
    );
    fireEvent.press(getByLabelText('Compartir'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
