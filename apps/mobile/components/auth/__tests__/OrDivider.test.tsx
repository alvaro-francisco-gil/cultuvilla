import { render } from '@testing-library/react-native';
import { I18nProvider } from '../../../lib/i18n';
import { OrDivider } from '../OrDivider';

describe('<OrDivider>', () => {
  it('renders the localized "O" label by default', () => {
    const { getByText } = render(
      <I18nProvider>
        <OrDivider />
      </I18nProvider>,
    );
    expect(getByText('O')).toBeTruthy();
  });

  it('renders a custom label when given', () => {
    const { getByText } = render(
      <I18nProvider>
        <OrDivider label="OR" />
      </I18nProvider>,
    );
    expect(getByText('OR')).toBeTruthy();
  });
});
