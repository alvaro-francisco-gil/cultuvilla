import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AppVersionGate } from '../AppVersionGate';

jest.mock('@cultuvilla/shared', () => ({
  getAppVersionConfig: jest.fn().mockResolvedValue(null),
  resolveVersionGate: jest.fn().mockReturnValue('ok'),
  spacing: { 2: 8 },
}));
jest.mock('../../lib/appVersion', () => ({
  getRunningVersion: () => '1.0.0',
  getGatePlatform: () => 'ios',
}));
jest.mock('../../lib/i18n', () => ({ useT: () => ({ t: (k: string) => k }) }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

it('renders children when the gate is ok', async () => {
  const { getByText } = render(
    <AppVersionGate><Text>child</Text></AppVersionGate>,
  );
  await waitFor(() => expect(getByText('child')).toBeTruthy());
});
