import { render, fireEvent } from '@testing-library/react-native';
import { EventCard } from '../EventCard';

// EventCard renders through FeedCard/primitives that (under the full parallel
// suite) can reach useT; stub i18n so the card never depends on a provider,
// matching the convention used across the app's component tests.
jest.mock('../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (k: string) => k }),
}));

/**
 * Fixture uses real EventData field names:
 *   startDate (Date)        — EventData.startDate
 *   locationName            — EventLike.locationName (maps to event.location.displayName)
 */
const fixture = {
  id: 'e1',
  title: 'Fiesta del pueblo',
  startDate: new Date('2026-06-15T18:00:00Z'),
  locationName: 'Plaza Mayor',
};

describe('<EventCard>', () => {
  it('renders title and location name', () => {
    const { getByText } = render(<EventCard event={fixture} onPress={() => {}} />);
    expect(getByText('Fiesta del pueblo')).toBeTruthy();
    expect(getByText(/Plaza Mayor/)).toBeTruthy();
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

  it('renders the comment count badge when commentCount > 0', () => {
    const { getByTestId, getByText } = render(
      <EventCard event={{ ...fixture, commentCount: 3 }} onPress={() => {}} />,
    );
    expect(getByTestId('feed-card-comment-count')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('renders no comment count badge when commentCount is 0 or undefined', () => {
    const { queryByTestId: queryZero } = render(
      <EventCard event={{ ...fixture, commentCount: 0 }} onPress={() => {}} />,
    );
    expect(queryZero('feed-card-comment-count')).toBeNull();

    const { queryByTestId: queryUndefined } = render(
      <EventCard event={fixture} onPress={() => {}} />,
    );
    expect(queryUndefined('feed-card-comment-count')).toBeNull();
  });
});
