import { render } from '@testing-library/react-native';
import { ContributorAvatars } from '../ContributorAvatars';

jest.mock('../LiveAvatar', () => {
  const { Text } = require('react-native');
  return { LiveAvatar: ({ ownerId }: { ownerId: string }) => <Text>{`avatar:${ownerId}`}</Text> };
});

describe('<ContributorAvatars>', () => {
  it('shows a face per contributor', () => {
    const { getByText } = render(<ContributorAvatars userIds={['ana', 'luis']} />);
    expect(getByText('avatar:ana')).toBeTruthy();
    expect(getByText('avatar:luis')).toBeTruthy();
  });

  // A row has room for a few faces; the rest collapse into a count.
  it('caps the faces and counts the rest', () => {
    const { getByText, queryByText } = render(
      <ContributorAvatars userIds={['a', 'b', 'c', 'd', 'e']} />,
    );
    expect(getByText('avatar:c')).toBeTruthy();
    expect(queryByText('avatar:d')).toBeNull();
    expect(getByText('+2')).toBeTruthy();
  });

  it('renders nothing when nobody is credited', () => {
    const { toJSON } = render(<ContributorAvatars userIds={[]} />);
    expect(toJSON()).toBeNull();
  });
});
