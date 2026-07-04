import { describe, it, expect } from 'vitest';
import { AppVersionConfigSchema } from '../../src/models/config';

const valid = {
  ios: { minSupported: '1.0.0', latest: '1.2.0' },
  android: { minSupported: '1.0.0', latest: '1.2.0' },
  storeUrl: { ios: 'https://apps.apple.com/app/id0', android: 'https://play.google.com/store/apps/details?id=x' },
};

describe('AppVersionConfigSchema', () => {
  it('accepts a well-formed config', () => {
    expect(AppVersionConfigSchema.parse(valid)).toEqual(valid);
  });

  it('rejects a config missing a platform', () => {
    const { android: _drop, ...rest } = valid;
    expect(() => AppVersionConfigSchema.parse(rest)).toThrow();
  });
});
