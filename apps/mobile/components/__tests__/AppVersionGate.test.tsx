import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AppVersionGate } from '../AppVersionGate';

jest.mock('@cultuvilla/shared', () => ({
  getAppVersionConfig: jest.fn().mockResolvedValue(null),
  resolveVersionGate: jest.fn().mockReturnValue('ok'),
}));
jest.mock('../../lib/appVersion', () => ({
  getRunningVersion: () => '1.0.0',
  getGatePlatform: () => 'ios',
}));
jest.mock('../../lib/i18n', () => ({ useT: () => ({ t: (k: string) => k }) }));

it('renders children when the gate is ok', async () => {
  const { getByText } = render(
    <AppVersionGate><Text>child</Text></AppVersionGate>,
  );
  await waitFor(() => expect(getByText('child')).toBeTruthy());
});
