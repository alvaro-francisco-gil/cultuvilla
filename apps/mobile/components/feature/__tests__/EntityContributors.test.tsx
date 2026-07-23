import { render } from '@testing-library/react-native';
import { EntityContributors } from '../EntityContributors';

jest.mock('../LiveOwnerChip', () => ({
  LiveOwnerChip: ({ ownerId, ownerType }: { ownerId: string; ownerType: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`${ownerType}:${ownerId}`}>{ownerId}</Text>;
  },
}));

describe('EntityContributors', () => {
  it('renders people and organizations under the supplied credit label', () => {
    const { getByText } = render(
      <EntityContributors label="Contribuyeron" userIds={['u1']} orgIds={['o1']} />,
    );
    getByText('Contribuyeron');
    expect(getByText('o1')).toBeTruthy();
    expect(getByText('u1')).toBeTruthy();
  });

  it('renders nothing when there are no public credits', () => {
    const { toJSON } = render(<EntityContributors label="Contribuyeron" userIds={[]} orgIds={[]} />);
    expect(toJSON()).toBeNull();
  });
});
