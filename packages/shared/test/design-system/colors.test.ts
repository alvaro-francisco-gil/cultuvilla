import { describe, expect, it } from 'vitest';
import { colors, type ColorMode } from '../../src/design-system/tokens/colors';

describe('semantic color tokens', () => {
  it('has a light mode', () => {
    expect(colors.light).toBeDefined();
  });

  it('exposes bg, fg, and border groups (per Tailwind utility family)', () => {
    expect(Object.keys(colors.light).sort()).toEqual(['bg', 'border', 'fg']);
  });

  it('every color value is a 7-char hex string (#rrggbb)', () => {
    for (const group of Object.values(colors.light)) {
      for (const value of Object.values(group)) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('fg.on-accent contrasts with bg.accent (sanity: different hex)', () => {
    expect(colors.light.fg['on-accent']).not.toBe(colors.light.bg.accent);
  });

  it('bg has the surface, accent, danger, success roles', () => {
    expect(colors.light.bg.surface).toBeDefined();
    expect(colors.light.bg.accent).toBeDefined();
    expect(colors.light.bg.danger).toBeDefined();
    expect(colors.light.bg.success).toBeDefined();
  });

  it('ColorMode union includes light (dark added later)', () => {
    const m: ColorMode = 'light';
    expect(colors[m]).toBeDefined();
  });
});
