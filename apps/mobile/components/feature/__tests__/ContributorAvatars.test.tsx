import { render } from '@testing-library/react-native';
import { ContributorAvatars } from '../ContributorAvatars';

jest.mock('../LiveAvatar', () => {
  const { Text } = require('react-native');
  return {
    LiveAvatar: ({ ownerId, ownerType }: { ownerId: string; ownerType: string }) => (
      <Text>{`${ownerType}:${ownerId}`}</Text>
    ),
  };
});

describe('<ContributorAvatars>', () => {
  it('shows a face per contributor', () => {
    const { getByText } = render(<ContributorAvatars userIds={['ana', 'luis']} orgIds={[]} />);
    expect(getByText('user:ana')).toBeTruthy();
    expect(getByText('user:luis')).toBeTruthy();
  });

  // A row has room for a few faces; the rest collapse into a count.
  it('caps the faces and counts the rest', () => {
    const { getByText, queryByText } = render(
      <ContributorAvatars userIds={['a', 'b', 'c', 'd', 'e']} orgIds={[]} />,
    );
    expect(getByText('user:d')).toBeTruthy();
    expect(queryByText('user:e')).toBeNull();
    expect(getByText('+1')).toBeTruthy();
  });

  // The group's icon leads: "Ayer dijimos algo" + two villagers reads as the
  // podcast's word, not as two people's.
  it('shows the groups first, then the villagers', () => {
    const { getAllByText } = render(
      <ContributorAvatars userIds={['ana']} orgIds={['podcast']} />,
    );
    expect(getAllByText(/^(user|organization):/).map((n) => n.props.children)).toEqual([
      'organization:podcast',
      'user:ana',
    ]);
  });

  it('renders nothing when nobody is credited', () => {
    const { toJSON } = render(<ContributorAvatars userIds={[]} orgIds={[]} />);
    expect(toJSON()).toBeNull();
  });
});
