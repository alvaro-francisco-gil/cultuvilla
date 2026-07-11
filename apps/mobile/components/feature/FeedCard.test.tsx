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
  it('shows the comment count in place of metaRight when commentCount > 0', () => {
    const { getByTestId, getByText, queryByText } = render(
      <FeedCard {...BASE_PROPS} commentCount={3} />,
    );
    expect(getByTestId('feed-card-comment-count')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
    // The count replaces metaRight — the date is no longer shown.
    expect(queryByText('12 jul')).toBeNull();
  });

  it('shows metaRight and no comment count when commentCount is 0 or absent', () => {
    const { getByText, queryByTestId, rerender } = render(
      <FeedCard {...BASE_PROPS} commentCount={0} />,
    );
    expect(queryByTestId('feed-card-comment-count')).toBeNull();
    expect(getByText('12 jul')).toBeTruthy();

    rerender(<FeedCard {...BASE_PROPS} />);
    expect(queryByTestId('feed-card-comment-count')).toBeNull();
    expect(getByText('12 jul')).toBeTruthy();
  });

  it('shows nothing on the right when metaRight is empty and there are no comments', () => {
    const { queryByTestId } = render(<FeedCard {...BASE_PROPS} metaRight="" commentCount={0} />);
    expect(queryByTestId('feed-card-comment-count')).toBeNull();
  });
});
