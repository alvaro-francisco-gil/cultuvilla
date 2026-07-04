import { getRunningVersion, getRunningBuild } from '../appVersion';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { nativeAppVersion: '1.4.0', nativeBuildVersion: '42', expoConfig: { version: '1.4.0' } },
}));

describe('appVersion', () => {
  it('reads the native application version', () => {
    expect(getRunningVersion()).toBe('1.4.0');
  });
  it('reads the native build version', () => {
    expect(getRunningBuild()).toBe('42');
  });
});
