import { render } from '@testing-library/react-native';
import { LiveOwnerChip } from '../LiveOwnerChip';
import { useOwnerSummary } from '../../../lib/useOwnerSummary';

jest.mock('../../../lib/useOwnerSummary', () => ({
  useOwnerSummary: jest.fn(),
}));

const mockUseOwnerSummary = useOwnerSummary as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('<LiveOwnerChip>', () => {
  it('renders the live name and its image', () => {
    mockUseOwnerSummary.mockReturnValue({
      name: 'Ana García',
      imageUri: 'https://img/ana.jpg',
      loading: false,
    });

    const { getByText, UNSAFE_getByType } = render(
      <LiveOwnerChip ownerId="u1" ownerType="user" />,
    );

    expect(useOwnerSummary).toHaveBeenCalledWith('u1', 'user');
    expect(getByText('Ana García')).toBeTruthy();
    const { Image } = require('react-native');
    expect(UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://img/ana.jpg' });
  });

  it('falls back to fallbackName and shows its initial when the doc has no name', () => {
    mockUseOwnerSummary.mockReturnValue({ name: null, imageUri: null, loading: false });

    const { getByText } = render(
      <LiveOwnerChip ownerId="u1" ownerType="user" fallbackName="uid-123" />,
    );

    expect(getByText('uid-123')).toBeTruthy();
    expect(getByText('U')).toBeTruthy(); // initial derived from the fallback label
  });

  it('prepends the prefix to the name', () => {
    mockUseOwnerSummary.mockReturnValue({
      name: 'Ayuntamiento',
      imageUri: null,
      loading: false,
    });

    const { getByText } = render(
      <LiveOwnerChip ownerId="o1" ownerType="organization" prefix="Por " />,
    );

    expect(getByText('Por Ayuntamiento')).toBeTruthy();
  });
});
