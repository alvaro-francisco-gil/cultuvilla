import { render } from '@testing-library/react-native';
import { Text } from '../Text';

describe('<Text>', () => {
  it('renders with default body variant', () => {
    const { getByText } = render(<Text>hello</Text>);
    const el = getByText('hello');
    expect(el.props.className).toMatch(/text-body/);
  });

  it('applies h1 variant class', () => {
    const { getByText } = render(<Text variant="h1">title</Text>);
    expect(getByText('title').props.className).toMatch(/text-h1/);
  });

  it('applies muted tone class', () => {
    const { getByText } = render(<Text tone="muted">quiet</Text>);
    expect(getByText('quiet').props.className).toMatch(/text-muted/);
  });

  it('applies danger tone class', () => {
    const { getByText } = render(<Text tone="danger">error</Text>);
    expect(getByText('error').props.className).toMatch(/text-danger/);
  });
});
