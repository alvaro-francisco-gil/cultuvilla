import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Linking, Text as RNText } from 'react-native';
import { AppVersionGate } from '../AppVersionGate';

const mockGetAppVersionConfig = jest.fn();
const mockResolveVersionGate = jest.fn();

jest.mock('@cultuvilla/shared', () => ({
  getAppVersionConfig: (...args: unknown[]) => mockGetAppVersionConfig(...args),
  resolveVersionGate: (...args: unknown[]) => mockResolveVersionGate(...args),
  // The cooldown is real logic, not a stub — the "stays quiet" test below is
  // only meaningful if it runs the same function the app runs.
  shouldPromptUpdate: jest.requireActual('@cultuvilla/shared/utils/versionGate')
    .shouldPromptUpdate,
}));
jest.mock('../../lib/appVersion', () => ({
  getRunningVersion: () => '1.0.0',
  getGatePlatform: () => 'ios',
}));
jest.mock('../../lib/i18n', () => ({ useT: () => ({ t: (k: string) => k }) }));

const mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockStore[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      mockStore[k] = v;
    }),
  },
}));

const CONFIG = {
  ios: { minSupported: '1.0.0', latest: '2.0.0' },
  android: { minSupported: '1.0.0', latest: '2.0.0' },
  storeUrl: { ios: 'https://apps.apple.com/app/id1', android: 'https://play.example' },
};

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockGetAppVersionConfig.mockResolvedValue(CONFIG);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

const renderGate = () =>
  render(
    <AppVersionGate>
      <RNText>child</RNText>
    </AppVersionGate>,
  );

it('renders children when the gate is ok', async () => {
  mockResolveVersionGate.mockReturnValue('ok');
  const { getByText, queryByTestId } = renderGate();
  await waitFor(() => expect(getByText('child')).toBeTruthy());
  expect(queryByTestId('app-update-modal')).toBeNull();
});

it('shows a non-dismissible modal when the client is below minSupported', async () => {
  mockResolveVersionGate.mockReturnValue('block');
  const { getByText, queryByTestId } = renderGate();
  await waitFor(() => expect(getByText('appUpdate.blockTitle')).toBeTruthy());
  // No "later" escape hatch on the hard block.
  expect(queryByTestId('app-update-dismiss')).toBeNull();
  fireEvent.press(getByText('appUpdate.cta'));
  expect(Linking.openURL).toHaveBeenCalledWith(CONFIG.storeUrl.ios);
});

it('shows a dismissible modal when a newer version is available', async () => {
  mockResolveVersionGate.mockReturnValue('nudge');
  const { getByText, getByTestId, queryByText } = renderGate();
  await waitFor(() => expect(getByText('appUpdate.nudgeTitle')).toBeTruthy());
  expect(getByTestId('app-update-dismiss')).toBeTruthy();
  fireEvent.press(getByText('appUpdate.later'));
  await waitFor(() => expect(queryByText('appUpdate.nudgeTitle')).toBeNull());
});

it('stays quiet on the next launch, inside the cooldown for the same version', async () => {
  mockResolveVersionGate.mockReturnValue('nudge');
  const first = renderGate();
  await waitFor(() => expect(first.getByText('appUpdate.nudgeTitle')).toBeTruthy());
  first.unmount();

  const second = renderGate();
  await waitFor(() => expect(second.getByText('child')).toBeTruthy());
  expect(second.queryByText('appUpdate.nudgeTitle')).toBeNull();
});
