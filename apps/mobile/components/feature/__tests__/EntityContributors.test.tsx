import { render, fireEvent } from '@testing-library/react-native';
import { EntityContributors } from '../EntityContributors';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('../LiveOwnerChip', () => ({
  LiveOwnerChip: ({
    ownerId,
    ownerType,
    onPress,
  }: {
    ownerId: string;
    ownerType: string;
    onPress?: () => void;
  }) => {
    const { Text } = require('react-native');
    return (
      <Text testID={`${ownerType}:${ownerId}`} onPress={onPress}>
        {ownerId}
      </Text>
    );
  },
}));

const { router } = jest.requireMock('expo-router');

describe('EntityContributors', () => {
  beforeEach(() => jest.clearAllMocks());

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

  it('opens a credited person profile when their chip is pressed', () => {
    const { getByTestId } = render(
      <EntityContributors label="Contribuyeron" userIds={['u1']} orgIds={[]} />,
    );
    fireEvent.press(getByTestId('user:u1'));
    expect(router.push).toHaveBeenCalledWith('/user/u1');
  });

  it('opens a credited organization when its chip is pressed', () => {
    const { getByTestId } = render(
      <EntityContributors label="Contribuyeron" userIds={[]} orgIds={['o1']} />,
    );
    fireEvent.press(getByTestId('organization:o1'));
    expect(router.push).toHaveBeenCalledWith('/o/o1');
  });
});
