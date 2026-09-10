import { palette } from '@cultuvilla/shared/design-system';

/** 9:16 — the WhatsApp status / Instagram story frame the cards are shared into. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;
export const GUTTER = 72;

export const colors = {
  ground: '#1f1a17',
  groundRaised: '#2b2420',
  line: '#3d332d',
  ink: palette.cream,
  inkDim: '#c9b9ab',
  muted: '#8f7f73',
  accent: palette.terracotta,
  accentSoft: palette.clay,
  olive: palette.olive,
  sage: palette.sage,
  peach: palette.peach,
};

/** Initials bubbles cycle through the brand palette so a wall of them reads as
 *  the app's own colours, not a random rainbow. */
export const bubblePalette = [palette.terracotta, palette.olive, palette.clay, palette.sage, palette.rust, palette.peach];
