import logoPng from './logo.png';
import letteringPng from './lettering.png';
import { h, type SatoriNode } from '../h';

/**
 * Downscaled copies of the brand masters — `apps/mobile/assets/logo.png` (160px)
 * and `packages/shared/assets/brand/cultuvilla-lettering.svg` (rasterized to
 * 1000px), both transparent. Copies rather than imports across workspaces: the
 * functions bundle is built and uploaded on its own, and the masters are many
 * times the size the largest mark here is ever drawn at. The lettering is used
 * as drawn, never re-typeset, so its Titan One outlines and the tightened L–T
 * pair survive exactly.
 */
const LOGO_DATA_URI = `data:image/png;base64,${Buffer.from(logoPng).toString('base64')}`;
const LETTERING_DATA_URI = `data:image/png;base64,${Buffer.from(letteringPng).toString('base64')}`;
const LETTERING_ASPECT = 1000 / 120;

/** How much taller than the lettering the icon is drawn. */
const ICON_SCALE = 2;

/**
 * The Cultuvilla icon beside its lettering, as every card signs off. `size` is
 * the lettering's height. The cover leads with the icon; the card footers put
 * it after the lettering, so it closes the row at the card's right edge.
 */
export function brandMark(size: number, iconSide: 'left' | 'right' = 'left'): SatoriNode {
  const icon = Math.round(size * ICON_SCALE);
  const height = Math.round(size);
  const logo = h('img', { src: LOGO_DATA_URI, width: icon, height: icon });
  const lettering = h('img', { src: LETTERING_DATA_URI, width: Math.round(height * LETTERING_ASPECT), height });
  return h(
    'div',
    { style: { display: 'flex', alignItems: 'center', gap: Math.round(size * 0.3) } },
    ...(iconSide === 'left' ? [logo, lettering] : [lettering, logo]),
  );
}
