import { render, fireEvent } from '@testing-library/react-native';
import { Fab } from '../Fab';

describe('<Fab>', () => {
  it('renders with testID', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<Fab onPress={onPress} label="Crear evento" testID="fab" />);
    expect(getByTestId('fab')).toBeTruthy();
  });

  it('fires onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<Fab onPress={onPress} label="Crear evento" testID="fab" />);
    fireEvent.press(getByTestId('fab'));
    expect(onPress).toHaveBeenCalled();
  });

  it('renders the provided label', () => {
    const { getByText } = render(<Fab onPress={jest.fn()} label="Crear noticia" />);
    expect(getByText('Crear noticia')).toBeTruthy();
  });
});
