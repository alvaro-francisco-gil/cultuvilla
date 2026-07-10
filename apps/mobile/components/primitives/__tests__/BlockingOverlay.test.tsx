import { render } from '@testing-library/react-native';
import { BlockingOverlay } from '../BlockingOverlay';

describe('<BlockingOverlay>', () => {
  it('shows the wait label when visible', () => {
    const { queryByText } = render(<BlockingOverlay visible label="Eliminando evento…" />);
    expect(queryByText('Eliminando evento…')).toBeTruthy();
  });

  it('does not render the label when hidden', () => {
    const { queryByText } = render(<BlockingOverlay visible={false} label="Eliminando evento…" />);
    expect(queryByText('Eliminando evento…')).toBeNull();
  });
});
