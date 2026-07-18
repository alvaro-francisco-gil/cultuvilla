import { fireEvent, render } from '@testing-library/react-native';
import { LivePersonChip } from '../LivePersonChip';
import { useOwnerSummary } from '../../../lib/useOwnerSummary';

jest.mock('../../../lib/useOwnerSummary', () => ({
  useOwnerSummary: jest.fn(),
}));

const mockUseOwnerSummary = useOwnerSummary as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('<LivePersonChip>', () => {
  it('resolves the person doc via useOwnerSummary and renders its live name + image', () => {
    mockUseOwnerSummary.mockReturnValue({
      name: 'Ana García',
      imageUri: 'https://img/ana.jpg',
      loading: false,
    });

    const { getByText, UNSAFE_getByType } = render(<LivePersonChip personId="p1" />);

    expect(useOwnerSummary).toHaveBeenCalledWith('p1', 'person');
    expect(getByText('Ana García')).toBeTruthy();
    const { Image } = require('react-native');
    expect(UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://img/ana.jpg' });
  });

  it('falls back to fallbackName when the person doc has no name yet', () => {
    mockUseOwnerSummary.mockReturnValue({ name: null, imageUri: null, loading: false });

    const { getByText } = render(<LivePersonChip personId="p1" fallbackName="Ana García" />);

    expect(getByText('Ana García')).toBeTruthy();
  });

  it('renders a tappable button that fires onPress when provided', () => {
    mockUseOwnerSummary.mockReturnValue({ name: 'Ana García', imageUri: null, loading: false });
    const onPress = jest.fn();

    const { getByRole } = render(<LivePersonChip personId="p1" onPress={onPress} />);

    const button = getByRole('button');
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
