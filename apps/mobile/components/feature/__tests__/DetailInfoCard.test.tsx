import { render, fireEvent } from '@testing-library/react-native';
import { DetailInfoCard } from '../DetailInfoCard';

describe('DetailInfoCard', () => {
  it('renders label + value and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <DetailInfoCard icon="calendar-outline" label="Fecha" value="12 jul" action="Añadir" onPress={onPress} />,
    );
    getByText('Fecha');
    fireEvent.press(getByText('12 jul'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
