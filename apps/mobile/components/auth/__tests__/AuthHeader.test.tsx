import { render } from '@testing-library/react-native';
import { AuthHeader } from '../AuthHeader';

describe('<AuthHeader>', () => {
  it('renders the title', () => {
    const { getByText } = render(<AuthHeader title="Iniciar sesión" />);
    expect(getByText('Iniciar sesión')).toBeTruthy();
  });

  it('renders the app logo image with an accessibility label', () => {
    const { getByLabelText } = render(<AuthHeader title="x" />);
    expect(getByLabelText('Cultuvilla')).toBeTruthy();
  });
});
