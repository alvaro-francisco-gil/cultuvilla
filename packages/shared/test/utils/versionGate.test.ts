import { describe, it, expect } from 'vitest';
import { resolveVersionGate } from '../../src/utils/versionGate';
import type { AppVersionConfig } from '../../src/models/config';

const config: AppVersionConfig = {
  ios: { minSupported: '1.2.0', latest: '1.5.0' },
  android: { minSupported: '1.1.0', latest: '1.5.0' },
  storeUrl: { ios: 'x', android: 'y' },
};

describe('resolveVersionGate', () => {
  it('blocks below minSupported', () => {
    expect(resolveVersionGate('1.1.0', config, 'ios')).toBe('block');
  });
  it('nudges between minSupported and latest', () => {
    expect(resolveVersionGate('1.3.0', config, 'ios')).toBe('nudge');
  });
  it('is ok at or above latest', () => {
    expect(resolveVersionGate('1.5.0', config, 'ios')).toBe('ok');
    expect(resolveVersionGate('2.0.0', config, 'ios')).toBe('ok');
  });
  it('uses the per-platform floor', () => {
    expect(resolveVersionGate('1.1.0', config, 'android')).toBe('nudge');
  });
  it('fails open on web', () => {
    expect(resolveVersionGate('0.0.1', config, 'web')).toBe('ok');
  });
  it('fails open on null config or malformed version', () => {
    expect(resolveVersionGate('1.0.0', null, 'ios')).toBe('ok');
    expect(resolveVersionGate('garbage', config, 'ios')).toBe('ok');
  });
});
