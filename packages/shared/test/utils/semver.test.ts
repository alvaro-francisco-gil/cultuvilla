import { describe, it, expect } from 'vitest';
import { compareVersions } from '../../src/utils/semver';

describe('compareVersions', () => {
  it('orders by major, then minor, then patch', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
    expect(compareVersions('1.3.0', '1.2.9')).toBe(1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
  });

  it('compares numerically, not lexically', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
  });

  it('throws on malformed input', () => {
    expect(() => compareVersions('1.2', '1.2.3')).toThrow();
    expect(() => compareVersions('1.2.x', '1.2.3')).toThrow();
    expect(() => compareVersions('', '1.2.3')).toThrow();
  });
});
