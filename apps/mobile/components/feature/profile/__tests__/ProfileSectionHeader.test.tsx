import { render } from '@testing-library/react-native';
import { ProfileSectionHeader } from '../ProfileSectionHeader';

describe('ProfileSectionHeader', () => {
  it('matches the village section title typography', () => {
    const { getByText } = render(<ProfileSectionHeader title="Personas" />);

    expect(getByText('Personas')).toHaveStyle({
      fontSize: 22,
      lineHeight: 30,
      marginTop: 1,
    });
  });
});
