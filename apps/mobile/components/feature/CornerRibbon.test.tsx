import { render } from '@testing-library/react-native';
import { CornerRibbon } from './CornerRibbon';
import { FeedCard } from './FeedCard';

const CARD_PROPS = {
  imageUri: null,
  title: 'Fiesta del pueblo',
  metaLeft: 'Plaza Mayor',
  metaRight: '12 jul',
  fallbackIcon: 'calendar-outline' as const,
  onPress: () => {},
};

describe('<CornerRibbon>', () => {
  it('renders a single line', () => {
    const { getByText, queryByText } = render(
      <CornerRibbon lines={['Apuntado']} tone="accent" testID="ribbon" />,
    );
    expect(getByText('Apuntado')).toBeTruthy();
    expect(queryByText('En espera')).toBeNull();
  });

  it('renders both lines of a split ribbon', () => {
    const { getByText } = render(
      <CornerRibbon lines={['Apuntado ×1', 'En espera ×2']} tone="split" testID="ribbon" />,
    );
    expect(getByText('Apuntado ×1')).toBeTruthy();
    expect(getByText('En espera ×2')).toBeTruthy();
  });

  // The band is one fixed size for every state — a corner that grew with its
  // label would make a column of cards look broken.
  it('uses the same clip geometry regardless of tone or line count', () => {
    const single = render(<CornerRibbon lines={['Apuntado']} tone="accent" testID="ribbon" />);
    const split = render(
      <CornerRibbon lines={['Apuntado ×1', 'En espera ×2']} tone="split" testID="ribbon" />,
    );
    const geometry = (tree: ReturnType<typeof render>) => {
      const { width, height } = tree.getByTestId('ribbon').props.style;
      return { width, height };
    };
    expect(geometry(single)).toEqual(geometry(split));
  });
});

describe('<FeedCard> corner ribbon', () => {
  it('draws the ribbon when one is passed', () => {
    const { getByText } = render(
      <FeedCard {...CARD_PROPS} cornerRibbon={{ lines: ['Apuntado'], tone: 'accent' }} />,
    );
    expect(getByText('Apuntado')).toBeTruthy();
  });

  it('draws no ribbon by default', () => {
    const { queryByText } = render(<FeedCard {...CARD_PROPS} />);
    expect(queryByText('Apuntado')).toBeNull();
  });
});
