import { render, fireEvent } from '@testing-library/react-native';
import { EventCard } from '../EventCard';

/**
 * Fixture uses real EventData field names:
 *   startDate (Date)        — EventData.startDate
 *   organizationName        — EventData.organizationName
 * The plan's fixture used startsAt/villageName — those are corrected here to
 * match the actual shared model.
 */
const fixture = {
  id: 'e1',
  title: 'Fiesta del pueblo',
  startDate: new Date('2026-06-15T18:00:00Z'),
  organizationName: 'Sotos',
};

describe('<EventCard>', () => {
  it('renders title and organization name', () => {
    const { getByText } = render(<EventCard event={fixture} onPress={() => {}} />);
    expect(getByText('Fiesta del pueblo')).toBeTruthy();
    expect(getByText(/Sotos/)).toBeTruthy();
  });

  it('fires onPress with event id', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <EventCard event={fixture} onPress={onPress} testID="card" />,
    );
    fireEvent.press(getByTestId('card'));
    expect(onPress).toHaveBeenCalledWith('e1');
  });

  it('renders a badge when provided', () => {
    const { getByText } = render(
      <EventCard event={fixture} onPress={() => {}} badge="En curso" />,
    );
    expect(getByText('En curso')).toBeTruthy();
  });

  it('renders no badge when none is provided', () => {
    const { queryByText } = render(<EventCard event={fixture} onPress={() => {}} />);
    expect(queryByText('En curso')).toBeNull();
  });
});
