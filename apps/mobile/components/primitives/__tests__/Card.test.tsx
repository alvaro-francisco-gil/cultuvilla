import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from '../Card';

describe('<Card>', () => {
  it('renders children with surface + rounded classes', () => {
    const { getByTestId } = render(<Card testID="c"><Text>x</Text></Card>);
    expect(getByTestId('c').props.className).toMatch(/bg-surface/);
    expect(getByTestId('c').props.className).toMatch(/rounded/);
  });

  it('elevated variant applies shadow', () => {
    const { getByTestId } = render(<Card testID="e" variant="elevated"><Text>x</Text></Card>);
    expect(getByTestId('e').props.className).toMatch(/shadow-sm/);
  });
});
