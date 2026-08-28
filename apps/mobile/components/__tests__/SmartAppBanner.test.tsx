import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SmartAppBanner } from '../SmartAppBanner';

// APP_STORES is mocked through a `mock`-prefixed holder so each test can set the
// URLs before rendering — jest.mock factories may only close over such names.
let mockStores = { ios: '', android: '' };
jest.mock('../../lib/appStores', () => ({
  get APP_STORES() {
    return mockStores;
  },
}));

let mockIsWeb = true;
jest.mock('../../lib/platform', () => ({
  get isWeb() {
    return mockIsWeb;
  },
}));

jest.mock('../../lib/i18n', () => ({ useT: () => ({ t: (k: string) => k }) }));

const asyncStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => asyncStore[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      asyncStore[k] = v;
    }),
  },
}));

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const IOS_URL = 'https://apps.apple.com/es/app/cultuvilla/id1';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.cultuvilla.app';

function setUserAgent(ua: string, maxTouchPoints = 0) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: ua, maxTouchPoints },
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(asyncStore)) delete asyncStore[k];
  mockStores = { ios: IOS_URL, android: ANDROID_URL };
  mockIsWeb = true;
  setUserAgent(DESKTOP);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

it('offers the App Store to an iPhone visitor', async () => {
  setUserAgent(IPHONE);
  const { findByTestId, getByText } = render(<SmartAppBanner />);
  await findByTestId('smart-app-banner');
  expect(getByText('smartBanner.subtitleIos')).toBeTruthy();

  fireEvent.press(getByText('smartBanner.cta'));
  expect(Linking.openURL).toHaveBeenCalledWith(IOS_URL);
});

it('offers Google Play to an Android visitor', async () => {
  setUserAgent(ANDROID);
  const { findByTestId, getByText } = render(<SmartAppBanner />);
  await findByTestId('smart-app-banner');
  expect(getByText('smartBanner.subtitleAndroid')).toBeTruthy();

  fireEvent.press(getByText('smartBanner.cta'));
  expect(Linking.openURL).toHaveBeenCalledWith(ANDROID_URL);
});

it('stays silent on desktop, where there is no store to send anyone to', async () => {
  const { queryByTestId } = render(<SmartAppBanner />);
  await waitFor(() => expect(queryByTestId('smart-app-banner')).toBeNull());
});

it('stays silent on native, where the visitor already has the app', async () => {
  mockIsWeb = false;
  setUserAgent(IPHONE);
  const { queryByTestId } = render(<SmartAppBanner />);
  await waitFor(() => expect(queryByTestId('smart-app-banner')).toBeNull());
});

// This is what keeps the whole feature dormant until release: iOS and Android
// go live independently, so a filled Android URL must not offer an iPhone
// visitor a link to nowhere.
it('stays silent for a platform whose store URL is not filled in yet', async () => {
  mockStores = { ios: '', android: ANDROID_URL };
  setUserAgent(IPHONE);
  const { queryByTestId } = render(<SmartAppBanner />);
  await waitFor(() => expect(queryByTestId('smart-app-banner')).toBeNull());
});

it('hides on dismiss and records the dismissal', async () => {
  setUserAgent(ANDROID);
  const { findByTestId, getByTestId, queryByTestId } = render(<SmartAppBanner />);
  await findByTestId('smart-app-banner');

  fireEvent.press(getByTestId('smart-app-banner-dismiss'));
  await waitFor(() => expect(queryByTestId('smart-app-banner')).toBeNull());

  const raw = asyncStore['cultuvilla:storeBanner:dismissal'];
  expect(raw).toBeDefined();
  expect(typeof (JSON.parse(raw as string) as { dismissedAt: unknown }).dismissedAt).toBe('number');
});

it('stays hidden on a later visit within the cooldown', async () => {
  asyncStore['cultuvilla:storeBanner:dismissal'] = JSON.stringify({ dismissedAt: Date.now() });
  setUserAgent(ANDROID);
  const { queryByTestId } = render(<SmartAppBanner />);
  await waitFor(() => expect(queryByTestId('smart-app-banner')).toBeNull());
});

it('offers again once the cooldown has elapsed', async () => {
  const longAgo = Date.now() - 400 * 24 * 60 * 60 * 1000;
  asyncStore['cultuvilla:storeBanner:dismissal'] = JSON.stringify({ dismissedAt: longAgo });
  setUserAgent(ANDROID);
  const { findByTestId } = render(<SmartAppBanner />);
  expect(await findByTestId('smart-app-banner')).toBeTruthy();
});

it('does not flash the banner before the stored dismissal has been read', async () => {
  asyncStore['cultuvilla:storeBanner:dismissal'] = JSON.stringify({ dismissedAt: Date.now() });
  setUserAgent(ANDROID);
  const { queryByTestId } = render(<SmartAppBanner />);
  // The assertion that matters is this synchronous one, before the storage read
  // resolves; the settle below only keeps the async state update inside act().
  expect(queryByTestId('smart-app-banner')).toBeNull();
  await waitFor(() => expect(queryByTestId('smart-app-banner')).toBeNull());
});
