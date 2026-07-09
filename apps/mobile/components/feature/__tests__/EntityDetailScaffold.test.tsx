import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { EntityDetailScaffold } from '../EntityDetailScaffold';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() } }));

describe('EntityDetailScaffold', () => {
  it('shows a spinner while loading and the title + body once loaded', () => {
    const { rerender, queryByText, getByText } = render(
      <EntityDetailScaffold loading imageUri={null} fallbackIcon="image-outline" title="Fiestas" />,
    );
    expect(queryByText('Fiestas')).toBeNull();

    rerender(
      <EntityDetailScaffold loading={false} imageUri={null} fallbackIcon="image-outline" title="Fiestas">
        <Text>cuerpo</Text>
      </EntityDetailScaffold>,
    );
    getByText('Fiestas');
    getByText('cuerpo');
  });

  it('renders the not-found state', () => {
    const { getByText } = render(
      <EntityDetailScaffold loading={false} notFound imageUri={null} fallbackIcon="image-outline" />,
    );
    getByText('common.notFound');
  });
});
