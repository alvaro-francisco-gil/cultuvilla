import { describe, it, expect } from 'vitest';
import { fitFontSize, fixedAspectGrid, hexLayout, mosaicLayout } from '../../wrapped/render/layout';

const BOX = { w: 936, h: 1360 };

function inBox(l: ReturnType<typeof hexLayout>, w: number, h: number): boolean {
  return l.positions.every(
    (p) => p.x >= -0.01 && p.y >= -0.01 && p.x + l.diameter <= w + 0.01 && p.y + l.diameter <= h + 0.01,
  );
}

function overlaps(l: ReturnType<typeof hexLayout>): boolean {
  const r = l.diameter / 2;
  for (let i = 0; i < l.positions.length; i++) {
    for (let j = i + 1; j < l.positions.length; j++) {
      const dx = l.positions[i].x - l.positions[j].x;
      const dy = l.positions[i].y - l.positions[j].y;
      if (Math.hypot(dx, dy) < 2 * r - 0.01) return true;
    }
  }
  return false;
}

describe('hexLayout', () => {
  // Matabuena's censo: the case the card was designed against.
  it('places every one of 272 people on the card', () => {
    const l = hexLayout(272, BOX.w, BOX.h);
    expect(l.positions).toHaveLength(272);
    expect(inBox(l, BOX.w, BOX.h)).toBe(true);
  });

  it('keeps Matabuena bubbles big enough to recognise a face', () => {
    expect(hexLayout(272, BOX.w, BOX.h).diameter).toBeGreaterThan(55);
  });

  it('never overlaps two bubbles', () => {
    expect(overlaps(hexLayout(272, BOX.w, BOX.h))).toBe(false);
  });

  // The same card has to work for a hamlet and a town: the bubbles shrink to
  // fit the pueblo instead of the pueblo being cut off.
  for (const n of [1, 7, 40, 173, 500, 1000]) {
    it(`fits ${String(n)} people without spilling or overlapping`, () => {
      const l = hexLayout(n, BOX.w, BOX.h);
      expect(l.positions).toHaveLength(n);
      expect(inBox(l, BOX.w, BOX.h)).toBe(true);
      expect(overlaps(l)).toBe(false);
    });
  }

  it('grows the bubbles as the pueblo gets smaller', () => {
    expect(hexLayout(40, BOX.w, BOX.h).diameter).toBeGreaterThan(hexLayout(272, BOX.w, BOX.h).diameter);
  });

  it('returns an empty layout for an empty pueblo', () => {
    expect(hexLayout(0, BOX.w, BOX.h).positions).toEqual([]);
  });
});

describe('mosaicLayout', () => {
  const W = 936;
  const H = 1300;
  const GAP = 14;

  for (const n of [1, 6, 14, 21, 40]) {
    it(`fits ${String(n)} event tiles inside the box`, () => {
      const g = mosaicLayout(n, W, H, GAP);
      expect(g.cols * g.rows).toBeGreaterThanOrEqual(n);
      // No tolerance: any overflow past the box, however small, makes flex-wrap
      // drop the last tile of a row onto the next one.
      expect(g.cols * g.tileWidth + (g.cols - 1) * GAP).toBeLessThanOrEqual(W);
      expect(g.rows * g.tileHeight + (g.rows - 1) * GAP).toBeLessThanOrEqual(H);
      expect(Number.isInteger(g.tileWidth)).toBe(true);
    });
  }

  it('lays Matabuena\'s 14 August events out in columns, not one long strip', () => {
    expect(mosaicLayout(14, W, H, GAP).cols).toBeGreaterThan(1);
  });
});

import { initials, colorFor } from '../../wrapped/render/images';

describe('initials', () => {
  it('takes first and last initials', () => {
    expect(initials('Lucía Sánchez Baeza')).toBe('LB');
  });

  it('strips accents so a combining mark never renders alone', () => {
    expect(initials('Álvaro Íñiguez')).toBe('AI');
  });

  // Real Matabuena names carry parentheticals; taking the first CHARACTER of
  // the last word rendered bubbles as "A(", "L(", "J(".
  it('ignores punctuation around a word', () => {
    expect(initials('Juan García (hijo)')).toBe('JH');
    expect(initials('Ana (la de Pepe)')).toBe('AP');
    expect(initials('"Tito" Martín')).toBe('TM');
  });

  it('never returns punctuation', () => {
    for (const n of ['Juan (hijo)', 'María (2)', '(Sin nombre)', 'Pepe -']) {
      expect(initials(n)).toMatch(/^[A-Z?]{1,2}$/);
    }
  });

  it('uses a single initial for a one-word name', () => {
    expect(initials('Destechaos')).toBe('D');
  });

  it('falls back to ? when there is no letter at all', () => {
    expect(initials('  ')).toBe('?');
    expect(initials('(2)')).toBe('?');
  });
});

describe('colorFor', () => {
  it('is stable for a name', () => {
    expect(colorFor('Lucía')).toBe(colorFor('Lucía'));
  });
});

describe('fixedAspectGrid', () => {
  const W = 936;
  const H = 1200;
  const GAP = 8;
  const POSTER = 2 / 3;

  // Matabuena's archive: 73 carteles, 1960 to 2026.
  for (const n of [1, 3, 12, 73, 200]) {
    it(`fits ${String(n)} carteles without leaving the box`, () => {
      const g = fixedAspectGrid(n, W, H, GAP, POSTER);
      expect(g.cols * g.rows).toBeGreaterThanOrEqual(n);
      // No tolerance: any overflow past the box, however small, makes flex-wrap
      // drop the last tile of a row onto the next one.
      expect(g.cols * g.tileWidth + (g.cols - 1) * GAP).toBeLessThanOrEqual(W);
      expect(g.rows * g.tileHeight + (g.rows - 1) * GAP).toBeLessThanOrEqual(H);
      expect(Number.isInteger(g.tileWidth)).toBe(true);
    });
  }

  it('never stretches a poster out of its aspect beyond pixel rounding', () => {
    for (const n of [1, 3, 73]) {
      const g = fixedAspectGrid(n, W, H, GAP, POSTER);
      expect(Math.abs(g.tileHeight - g.tileWidth / POSTER)).toBeLessThan(1);
    }
  });

  // The rendered wall showed nine columns while the layout said ten: 10 × 86.4
  // plus gaps is exactly the box width, and the float overshoot wrapped a tile.
  it('keeps the chosen column count when laid out with flex-wrap', () => {
    const g = fixedAspectGrid(73, W, 1250, GAP, POSTER);
    const rowWidth = g.cols * g.tileWidth + (g.cols - 1) * GAP;
    expect(rowWidth).toBeLessThanOrEqual(W);
    expect(Math.floor((W + GAP) / (g.tileWidth + GAP))).toBe(g.cols);
  });

  it('keeps 73 carteles large enough to read as posters', () => {
    expect(fixedAspectGrid(73, W, H, GAP, POSTER).tileWidth).toBeGreaterThan(80);
  });

  // 73 is prime, so every column count leaves a remainder; the default pick
  // left one poster alone on the last row.
  it('avoids leaving a single poster alone on the last row', () => {
    const g = fixedAspectGrid(73, W, H, GAP, POSTER);
    expect(73 % g.cols).not.toBe(1);
  });

  it('gives up at most 10% of tile size to avoid an orphan', () => {
    let largest = 0;
    for (let cols = 1; cols <= 14; cols++) {
      const rows = Math.ceil(73 / cols);
      largest = Math.max(largest, Math.floor(Math.min((W - GAP * (cols - 1)) / cols, ((H - GAP * (rows - 1)) / rows) * POSTER)));
    }
    expect(fixedAspectGrid(73, W, H, GAP, POSTER).tileWidth).toBeGreaterThanOrEqual(Math.floor(largest * 0.9));
  });

  it('draws a short archive bigger than a long one', () => {
    expect(fixedAspectGrid(3, W, H, GAP, POSTER).tileWidth).toBeGreaterThan(fixedAspectGrid(73, W, H, GAP, POSTER).tileWidth);
  });
});

describe('fitFontSize', () => {
  it('keeps a short title at full size', () => {
    expect(fitFontSize('Gracias', 936, 104)).toBe(104);
  });

  // The title that wrapped and pushed the header off the top of the card.
  it('shrinks a long title so it stays on one line', () => {
    const size = fitFontSize('66 años de carteles', 936, 104);
    expect(size).toBeLessThan(104);
    expect('66 años de carteles'.length * 0.54 * size).toBeLessThanOrEqual(936);
  });

  it('never goes below the floor, however long the title', () => {
    expect(fitFontSize('Fiestas en honor a Santiago Apóstol y San Cristóbal', 936, 104)).toBe(48);
  });
});
