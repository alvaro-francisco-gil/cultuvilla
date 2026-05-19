import { describe, expect, it } from 'vitest';
import { iconSizes, type IconSize } from '../../src/design-system/icons';

describe('icon sizes', () => {
  it('exposes sm/md/lg = 16/20/24', () => {
    expect(iconSizes).toEqual({ sm: 16, md: 20, lg: 24 });
  });

  it('IconSize union accepts known keys', () => {
    const s: IconSize = 'md';
    expect(iconSizes[s]).toBe(20);
  });
});
