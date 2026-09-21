import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { chipStyles, contrastRatio, ink, monogramColors, onAccent, surfaces } from './theme';

// The first version of this panel was unreadable: the brand palette's `fg-muted`
// on its `bg-surface` measures 2.15:1. These tests exist so that cannot recur —
// every text/background pairing the panel can render is asserted against WCAG AA
// (4.5:1 for body text).
const AA = 4.5;

describe('ink on surfaces', () => {
  for (const [inkName, inkValue] of Object.entries(ink)) {
    for (const surface of ['page', 'card', 'cardAlt'] as const) {
      it(`ink.${inkName} on surfaces.${surface} passes AA`, () => {
        expect(contrastRatio(inkValue, surfaces[surface])).toBeGreaterThanOrEqual(AA);
      });
    }
  }
});

describe('chips', () => {
  for (const [name, { fg, bg }] of Object.entries(chipStyles)) {
    it(`chip "${name}" passes AA`, () => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
    });
  }

  it('every chip background is distinguishable from the card it sits on', () => {
    // Not a WCAG rule — a chip whose fill matches the card reads as plain text
    // and loses the colour coding entirely.
    for (const [name, { bg }] of Object.entries(chipStyles)) {
      expect(contrastRatio(bg, surfaces.card), name).toBeGreaterThan(1.03);
    }
  });

  it('uses distinct hues rather than one colour at different opacities', () => {
    const backgrounds = new Set(Object.values(chipStyles).map((c) => c.bg));
    expect(backgrounds.size).toBeGreaterThanOrEqual(5);
  });
});

describe('monogram colours', () => {
  for (const [index, { fg, bg }] of monogramColors.entries()) {
    it(`monogram ${String(index)} passes AA`, () => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
    });
  }
});

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#bb5d3a', '#bb5d3a')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#2b301f', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#2b301f'), 10);
  });

  it('reproduces the failure this file exists to prevent', () => {
    // sage on cream — the shipped brand pairing that made the first panel unreadable.
    expect(contrastRatio('#a6a897', '#f9f0e8')).toBeLessThan(AA);
  });
});

describe('the stylesheet delegates every colour to this file', () => {
  const css = readFileSync(resolve(__dirname, 'styles.css'), 'utf8');

  it('contains no hex colour literals, so none can escape the AA check', () => {
    // rgb()/rgba() for shadows is fine — a shadow is not a text pairing. A hex
    // literal, though, is always a colour someone chose by eye.
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
  });

  it('white on the accent button passes AA', () => {
    expect(contrastRatio(onAccent, ink.accent)).toBeGreaterThanOrEqual(AA);
  });
});
