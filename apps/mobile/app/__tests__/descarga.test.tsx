import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { I18nProvider } from '../../lib/i18n';
import Descarga from '../descarga';

// Platform.OS is a plain mutable property on the RN module (see
// lib/__tests__/useWebPullToRefresh.test.tsx for the same pattern) — jest.mock of
// the Platform module doesn't work here because babel-preset-expo's jest preset
// bakes the platform into the babel transform, not the runtime module.
const originalOS = Platform.OS;

// appStores is mocked via a getter over a `mock`-prefixed holder so each test can
// vary which store listings exist.
let mockStores: { ios: string; android: string } = { ios: '', android: '' };
const mockRedirect = jest.fn();

// defineProperty, not an object-literal getter beside a spread: the spread
// transform copies the getter's value at factory time, before mockStores exists.
jest.mock('@cultuvilla/shared/config', () =>
  Object.defineProperty({ ...jest.requireActual('@cultuvilla/shared/config') }, 'APP_STORES', {
    get: () => mockStores,
  }),
);
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  Redirect: (props: { href: string }) => {
    mockRedirect(props.href);
    return null;
  },
}));

const IOS_URL = 'https://apps.apple.com/es/app/cultuvilla/id1';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.cultuvilla.app';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const locationReplace = jest.fn();

function setBrowser(userAgent: string, maxTouchPoints = 0) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent, maxTouchPoints },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'location', {
    value: { replace: locationReplace },
    configurable: true,
    writable: true,
  });
}

const renderDescarga = () =>
  render(
    <I18nProvider>
      <Descarga />
    </I18nProvider>,
  );

describe('Descarga endpoint', () => {
  beforeEach(() => {
    (Platform as { OS: typeof Platform.OS }).OS = 'web';
    mockStores = { ios: IOS_URL, android: ANDROID_URL };
    mockRedirect.mockClear();
    locationReplace.mockClear();
    setBrowser(DESKTOP);
  });

  afterEach(() => {
    (Platform as { OS: typeof Platform.OS }).OS = originalOS;
  });

  it('sends an iPhone straight to the App Store, with no picker in between', () => {
    setBrowser(IPHONE);
    renderDescarga();
    expect(locationReplace).toHaveBeenCalledWith(IOS_URL);
    expect(screen.queryByText('Descargar en Google Play')).toBeNull();
  });

  // iPadOS reports a desktop Mac UA; touch points are the only tell.
  it('sends an iPad (desktop UA + touch) to the App Store', () => {
    setBrowser(IPAD_DESKTOP_UA, 5);
    renderDescarga();
    expect(locationReplace).toHaveBeenCalledWith(IOS_URL);
  });

  it('sends an Android phone straight to Google Play', () => {
    setBrowser(ANDROID);
    renderDescarga();
    expect(locationReplace).toHaveBeenCalledWith(ANDROID_URL);
    expect(screen.queryByText('Descargar en el App Store')).toBeNull();
  });

  it('shows the store picker on desktop, where there is nothing to install', () => {
    renderDescarga();
    expect(locationReplace).not.toHaveBeenCalled();
    expect(screen.getByText('Descargar en el App Store')).toBeTruthy();
    expect(screen.getByText('Descargar en Google Play')).toBeTruthy();
    expect(screen.getByText('Seguir en la web')).toBeTruthy();
  });

  // A redirect to a missing listing would be a dead end; the picker still offers the web.
  it('falls back to the picker when the detected platform has no listing', () => {
    mockStores = { ios: '', android: ANDROID_URL };
    setBrowser(IPHONE);
    renderDescarga();
    expect(locationReplace).not.toHaveBeenCalled();
    expect(screen.getByText('Seguir en la web')).toBeTruthy();
  });

  it('native: the visitor already has the app, so it forwards to the feed', () => {
    (Platform as { OS: typeof Platform.OS }).OS = 'ios';
    setBrowser(IPHONE);
    renderDescarga();
    expect(mockRedirect).toHaveBeenCalledWith('/(tabs)');
    expect(locationReplace).not.toHaveBeenCalled();
  });
});
