import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { I18nProvider } from '../../lib/i18n';
import Descarga from '../descarga';

// Platform.OS is a plain mutable property on the RN module (see
// lib/__tests__/useWebPullToRefresh.test.tsx for the same pattern) — jest.mock of
// the Platform module doesn't work here because babel-preset-expo's jest preset
// bakes the platform into the babel transform, not the runtime module.
const originalOS = Platform.OS;

// appStores is mocked via getters over `mock`-prefixed holders so each test can
// vary the pre-release flag / store URLs.
let mockAppAvailable = false;
let mockStores: { ios: string; android: string } = { ios: '', android: '' };
const mockRedirect = jest.fn();

jest.mock('../../lib/appStores', () => ({
  get APP_AVAILABLE() {
    return mockAppAvailable;
  },
  get APP_STORES() {
    return mockStores;
  },
  APP_SCHEME: 'cultuvilla',
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  Redirect: (props: { href: string }) => {
    mockRedirect(props.href);
    return null;
  },
}));

const renderDescarga = () =>
  render(
    <I18nProvider>
      <Descarga />
    </I18nProvider>,
  );

describe('Descarga endpoint', () => {
  beforeEach(() => {
    (Platform as { OS: typeof Platform.OS }).OS = 'web';
    mockAppAvailable = false;
    mockStores = { ios: '', android: '' };
    mockRedirect.mockClear();
  });

  afterEach(() => {
    (Platform as { OS: typeof Platform.OS }).OS = originalOS;
  });

  it('pre-release (web): redirects straight to the feed, renders no landing', () => {
    renderDescarga();
    expect(mockRedirect).toHaveBeenCalledWith('/(tabs)');
    expect(screen.queryByText('Cultuvilla')).toBeNull();
    expect(screen.queryByText('Descargar en el App Store')).toBeNull();
  });

  it('post-release (web): shows store buttons + continue-on-web, no redirect', () => {
    mockAppAvailable = true;
    mockStores = { ios: 'https://apps.apple.com/app/x', android: 'https://play.google.com/store/apps/x' };
    renderDescarga();
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getByText('Descargar en el App Store')).toBeTruthy();
    expect(screen.getByText('Descargar en Google Play')).toBeTruthy();
    expect(screen.getByText('Seguir en la web')).toBeTruthy();
  });
});
