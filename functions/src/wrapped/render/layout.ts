/**
 * Pure geometry for the Wrapped cards, kept out of the Satori trees so the
 * guarantees — every bubble fits, nothing spills off the card — are testable.
 */

export interface Bubble {
  x: number;
  y: number;
}

export interface HexLayout {
  diameter: number;
  positions: Bubble[];
  width: number;
  height: number;
}

/** Fraction of a cell a bubble fills; the rest is the gap between neighbours. */
const FILL = 0.88;
const ROW_STEP = Math.sqrt(3) / 2;

/**
 * Pack `count` circles into a `boxWidth × boxHeight` box on a hex grid (odd rows
 * offset by half a cell), as large as they can be while all of them fit.
 *
 * Tries every column count and keeps the one giving the biggest cell, which is
 * what lets one function serve a 40-member hamlet and a 1,000-member town: the
 * bubbles shrink to fit the pueblo rather than the pueblo being truncated.
 */
export function hexLayout(count: number, boxWidth: number, boxHeight: number): HexLayout {
  if (count <= 0) return { diameter: 0, positions: [], width: 0, height: 0 };

  let best = { cell: 0, cols: 1, rows: count };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    // An offset row needs an extra half cell of width whenever there is more than one row.
    const cellByWidth = boxWidth / (cols + (rows > 1 ? 0.5 : 0));
    const cellByHeight = boxHeight / (1 + (rows - 1) * ROW_STEP);
    const cell = Math.min(cellByWidth, cellByHeight);
    if (cell > best.cell) best = { cell, cols, rows };
  }

  const { cell, cols, rows } = best;
  const diameter = cell * FILL;
  const inset = (cell - diameter) / 2;
  const usedWidth = cell * (cols + (rows > 1 ? 0.5 : 0));
  const usedHeight = cell * (1 + (rows - 1) * ROW_STEP);
  // Centre the packed block inside the box.
  const offsetX = (boxWidth - usedWidth) / 2;
  const offsetY = (boxHeight - usedHeight) / 2;

  const positions: Bubble[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const shift = row % 2 === 1 ? cell / 2 : 0;
    positions.push({
      x: offsetX + col * cell + shift + inset,
      y: offsetY + row * cell * ROW_STEP + inset,
    });
  }
  return { diameter, positions, width: usedWidth, height: usedHeight };
}

/**
 * Tile sizes are always whole pixels. The cards lay tiles out with
 * `flex-wrap`, and a row that fills its box EXACTLY in fractional pixels
 * (10 × 86.4 + 9 × 8 = 936) lands a hair over the width in floating point, so
 * the last tile silently wraps and a ten-column wall renders as nine.
 */
export interface GridLayout {
  cols: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
}

/**
 * Tile grid for the events mosaic: the column count whose tiles come closest to
 * a flyer's aspect ratio while every event still fits.
 */
export function mosaicLayout(count: number, boxWidth: number, boxHeight: number, gap: number, aspect = 4 / 3): GridLayout {
  if (count <= 0) return { cols: 1, rows: 0, tileWidth: boxWidth, tileHeight: 0 };
  let best: GridLayout & { score: number } = { cols: 1, rows: count, tileWidth: 0, tileHeight: 0, score: Infinity };
  for (let cols = 1; cols <= Math.min(count, 5); cols++) {
    const rows = Math.ceil(count / cols);
    const tileWidth = (boxWidth - gap * (cols - 1)) / cols;
    const tileHeight = (boxHeight - gap * (rows - 1)) / rows;
    if (tileWidth <= 0 || tileHeight <= 0) continue;
    const score = Math.abs(Math.log(tileWidth / tileHeight / aspect));
    if (score < best.score) best = { cols, rows, tileWidth, tileHeight, score };
  }
  const { cols, rows, tileWidth, tileHeight } = best;
  return { cols, rows, tileWidth: Math.floor(tileWidth), tileHeight: Math.floor(tileHeight) };
}

/**
 * Grid of tiles at a FIXED aspect ratio, as large as they can be while all fit.
 *
 * Unlike `mosaicLayout`, tiles never stretch to fill the box: a cartel is a
 * portrait poster, and a stretched or heavily cropped one stops reading as a
 * poster. A short archive gets big posters and leaves room below; a long one
 * gets a dense wall.
 */
export function fixedAspectGrid(
  count: number,
  boxWidth: number,
  boxHeight: number,
  gap: number,
  aspect: number,
  maxCols = 14,
): GridLayout {
  if (count <= 0) return { cols: 1, rows: 0, tileWidth: 0, tileHeight: 0 };
  const candidates: GridLayout[] = [];
  for (let cols = 1; cols <= Math.min(count, maxCols); cols++) {
    const rows = Math.ceil(count / cols);
    const byWidth = (boxWidth - gap * (cols - 1)) / cols;
    const byHeight = ((boxHeight - gap * (rows - 1)) / rows) * aspect;
    const tileWidth = Math.floor(Math.min(byWidth, byHeight));
    candidates.push({ cols, rows, tileWidth, tileHeight: Math.floor(tileWidth / aspect) });
  }
  const largest = Math.max(...candidates.map((c) => c.tileWidth));
  // A single tile alone on the last row reads as a mistake. Give up to 10% of
  // tile size to avoid one — but only that much: a wall of tiny posters to dodge
  // an orphan would be the worse trade.
  const orphan = (c: GridLayout) => c.rows > 1 && count % c.cols === 1;
  const viable = candidates.filter((c) => c.tileWidth >= largest * 0.9 && !orphan(c));
  const pool = viable.length > 0 ? viable : candidates;
  return pool.reduce((best, c) => (c.tileWidth > best.tileWidth ? c : best));
}

/**
 * Largest font size at which `text` fits on one line in `maxWidth`.
 *
 * Satori cannot measure text before layout, so this is an estimate from an
 * average advance width per character (`emPerChar`). The card headers are built
 * for a single line; a title that wraps overflows the header upward and crowds
 * the kicker against the top of the image. Underestimating is safe — the title
 * is a little smaller; overestimating is not.
 */
export function fitFontSize(text: string, maxWidth: number, maxSize: number, minSize = 48, emPerChar = 0.54): number {
  if (text.length === 0) return maxSize;
  const fitted = Math.floor(maxWidth / (text.length * emPerChar));
  return Math.max(minSize, Math.min(maxSize, fitted));
}
