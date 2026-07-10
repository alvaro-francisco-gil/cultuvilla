import { render, fireEvent } from '@testing-library/react-native';
import { StatsRow } from '../StatsRow';

describe('StatsRow', () => {
  it('renders a stat with onPress as a tappable button and fires it', () => {
    const onPress = jest.fn();
    const { getByLabelText, queryByRole } = render(
      <StatsRow stats={[{ label: 'Personas', value: 12, onPress }]} />,
    );
    expect(queryByRole('button')).toBeTruthy();
    fireEvent.press(getByLabelText('Personas'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders a stat without onPress as plain, non-interactive content', () => {
    const { getByText, queryByRole } = render(
      <StatsRow stats={[{ label: 'Lugares', value: 3 }]} />,
    );
    expect(getByText('Lugares')).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
  });

  it('shows an em dash for a null value', () => {
    const { getByText } = render(<StatsRow stats={[{ label: 'Personas', value: null }]} />);
    expect(getByText('—')).toBeTruthy();
  });
});
