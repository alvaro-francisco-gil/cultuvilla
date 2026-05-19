import { describe, expect, it } from 'vitest';
import {
  typography,
  type TypographyVariant,
} from '../../src/design-system/tokens/typography';

describe('typography tokens', () => {
  it('defines exactly 7 variants', () => {
    expect(Object.keys(typography).sort()).toEqual(
      ['body', 'bodySm', 'caption', 'display', 'h1', 'h2', 'h3'].sort(),
    );
  });

  it('each variant carries fontSize + lineHeight + fontWeight', () => {
    for (const v of Object.values(typography)) {
      expect(typeof v.fontSize).toBe('number');
      expect(typeof v.lineHeight).toBe('number');
      expect(typeof v.fontWeight).toBe('string');
    }
  });

  it('headlines use a tighter line-height than body (~1.2 vs ~1.5)', () => {
    const h1Ratio = typography.h1.lineHeight / typography.h1.fontSize;
    const bodyRatio = typography.body.lineHeight / typography.body.fontSize;
    expect(h1Ratio).toBeLessThan(bodyRatio);
  });

  it('body is 16/24 — the read-baseline', () => {
    expect(typography.body.fontSize).toBe(16);
    expect(typography.body.lineHeight).toBe(24);
  });

  it('TypographyVariant is the keys of typography', () => {
    const v: TypographyVariant = 'body';
    expect(typography[v]).toBeDefined();
  });
});
