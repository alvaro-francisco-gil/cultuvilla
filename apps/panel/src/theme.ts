/**
 * The panel's colour scale, with every pairing measured against WCAG AA.
 *
 * It does NOT reuse the app's semantic tokens for text. The brand palette is
 * tuned for a warm consumer app, and on a data-dense table it fails badly: the
 * shipped `fg-muted` (sage) on `bg-surface` (cream) measures **2.15:1**, and on
 * `bg-subtle` (peach) **1.19:1** — which is why the first version of this panel
 * had secondary text nobody could read. Brand hues stay for accents; the ink
 * ramp is darker and measured. `theme.test.ts` enforces that.
 */

/** Page and card surfaces. Cards are white so the ink ramp has maximum headroom. */
export const surfaces = {
  page: '#f9f0e8', // brand cream
  card: '#ffffff',
  cardAlt: '#fbf7f2',
  border: '#e3d8cc',
  borderStrong: '#c9b7a5',
} as const;

/** Ink ramp. `ink` on `card` measures 13.59:1; `muted` 6.26:1. */
export const ink = {
  strong: '#2b301f',
  base: '#3b4230',
  muted: '#5c6350',
  accent: '#8f4526', // terracotta darkened until it passes AA on cream (6.12:1)
} as const;

/** Text on an accent-filled button. */
export const onAccent = '#ffffff';

/**
 * Chip families, by what the label *means* rather than by which field it came
 * from — so "presentada" and "enviada" look the same because they are the same
 * kind of fact, and a reader learns four colours instead of twenty words.
 */
export const chipStyles = {
  neutral: { fg: '#43483a', bg: '#eceadf' },
  activo: { fg: '#8f4526', bg: '#fbe6da' },
  comprometido: { fg: '#1f5560', bg: '#ddeef1' },
  logrado: { fg: '#1e6b3a', bg: '#ddf2e3' },
  cerrado: { fg: '#5c6350', bg: '#f0efe8' },
  aviso: { fg: '#7a4b00', bg: '#fbeed2' },
  urgente: { fg: '#a3241a', bg: '#fde3e0' },
  fitAlto: { fg: '#8f4526', bg: '#fbe6da' },
  fitMedio: { fg: '#5c6350', bg: '#f0efe8' },
  fitBajo: { fg: '#63695a', bg: '#f6f5f0' },
} as const;

export type ChipStyle = keyof typeof chipStyles;

/** Deterministic hue per entity, for the monogram shown when there is no logo. */
export const monogramColors = [
  { fg: '#8f4526', bg: '#fbe6da' },
  { fg: '#1f5560', bg: '#ddeef1' },
  { fg: '#1e6b3a', bg: '#ddf2e3' },
  { fg: '#7a4b00', bg: '#fbeed2' },
  { fg: '#43483a', bg: '#eceadf' },
] as const;

const channels = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const linearise = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Relative luminance, per WCAG 2.1. */
export function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = channels(hex).map(linearise);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
