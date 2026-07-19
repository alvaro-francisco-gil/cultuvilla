import { render } from '@testing-library/react-native';
import { EntityCard } from '../VillageSections';

describe('<EntityCard>', () => {
  it('renders the comment count badge when commentCount > 0', () => {
    const { getByTestId, getByText } = render(
      <EntityCard label="La Fiesta" icon="calendar-outline" commentCount={5} />,
    );
    expect(getByTestId('entity-card-comment-count')).toBeTruthy();
    expect(getByText('5')).toBeTruthy();
  });

  it('renders an alternate stat badge instead of the comment badge', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <EntityCard
        label="Cementerio"
        icon="location-outline"
        commentCount={5}
        statBadge={{ icon: 'person-outline', count: 7, testID: 'entity-card-burial-count' }}
      />,
    );
    expect(getByTestId('entity-card-burial-count')).toBeTruthy();
    expect(getByText('7')).toBeTruthy();
    expect(queryByTestId('entity-card-comment-count')).toBeNull();
  });

  it('renders no comment count badge when commentCount is 0', () => {
    const { queryByTestId } = render(
      <EntityCard label="La Fiesta" icon="calendar-outline" commentCount={0} />,
    );
    expect(queryByTestId('entity-card-comment-count')).toBeNull();
  });

  it('renders no comment count badge when commentCount is undefined', () => {
    const { queryByTestId } = render(<EntityCard label="La Fiesta" icon="calendar-outline" />);
    expect(queryByTestId('entity-card-comment-count')).toBeNull();
  });

  it('never renders the comment count badge on a crest card (villages are not commentable)', () => {
    const { queryByTestId } = render(
      <EntityCard label="Villalba" icon="home-outline" commentCount={5} crest />,
    );
    expect(queryByTestId('entity-card-comment-count')).toBeNull();
  });
});
