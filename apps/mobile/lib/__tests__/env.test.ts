import { describe, expect, it, jest } from '@jest/globals';

describe('getAppEnv', () => {
  it('returns the APP_ENV from expoConfig.extra', () => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra: { APP_ENV: 'beta' } } },
    }));
    const { getAppEnv } = require('../env');
    expect(getAppEnv()).toBe('beta');
  });

  it('falls back to dev if APP_ENV is missing', () => {
    jest.resetModules();
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra: {} } },
    }));
    const { getAppEnv } = require('../env');
    expect(getAppEnv()).toBe('dev');
  });

  it('throws on unrecognised values', () => {
    jest.resetModules();
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra: { APP_ENV: 'staging' } } },
    }));
    const { getAppEnv } = require('../env');
    expect(() => getAppEnv()).toThrow(/Unknown APP_ENV/);
  });
});
