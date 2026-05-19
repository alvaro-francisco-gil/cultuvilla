/**
 * Type scale. Seven variants. Each carries a font-size, a line-height
 * (in px, not unitless ratio — RN doesn't accept ratios), and a default
 * font-weight that callers can override at the use site.
 *
 * Why explicit line-heights: tight ratios (~1.2) for headlines kill
 * vertical rhythm in body text, and loose ratios (~1.5) in headlines
 * make them feel slack. Pairing size + line-height per variant locks
 * the rhythm without per-screen tuning.
 */
export const typography = {
  display: { fontSize: 36, lineHeight: 40, fontWeight: '700' },
  h1: { fontSize: 30, lineHeight: 36, fontWeight: '700' },
  h2: { fontSize: 24, lineHeight: 30, fontWeight: '600' },
  h3: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodySm: { fontSize: 14, lineHeight: 21, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

export type TypographyVariant = keyof typeof typography;
