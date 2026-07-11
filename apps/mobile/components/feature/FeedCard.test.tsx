import { render } from '@testing-library/react-native';
import { FeedCard } from './FeedCard';

const BASE_PROPS = {
  imageUri: null,
  title: 'Fiesta del pueblo',
  metaLeft: 'Plaza Mayor',
  metaRight: '12 jul',
  fallbackIcon: 'calendar-outline' as const,
  onPress: () => {},
};

describe('<FeedCard>', () => {
  it('shows the comment count on the title row when commentCount > 0', () => {
    const { getByTestId, getByText } = render(<FeedCard {...BASE_PROPS} commentCount={3} />);
    expect(getByText('3')).toBeTruthy();
    expect(getByTestId('feed-card-comment-count')).toBeTruthy();
  });

  it('hides the comment count when commentCount is 0 or absent', () => {
    const { queryByTestId, rerender } = render(<FeedCard {...BASE_PROPS} commentCount={0} />);
    expect(queryByTestId('feed-card-comment-count')).toBeNull();

    rerender(<FeedCard {...BASE_PROPS} />);
    expect(queryByTestId('feed-card-comment-count')).toBeNull();
  });
});
