import { render, fireEvent } from '@testing-library/react-native';
import { DetailInfoCard } from '../DetailInfoCard';

describe('DetailInfoCard', () => {
  it('renders label + single-line value and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <DetailInfoCard icon="calendar-outline" label="Fecha" value="2 de Julio · 20:00" onPress={onPress} />,
    );
    getByText('Fecha');
    fireEvent.press(getByText('2 de Julio · 20:00'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
