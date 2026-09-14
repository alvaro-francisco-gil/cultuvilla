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

/** The Cultuvilla icon beside its lettering, as every card signs off. `size` is the lettering's height. */
export function brandMark(size: number): SatoriNode {
  const icon = Math.round(size * 1.35);
  const height = Math.round(size);
  return h(
    'div',
    { style: { display: 'flex', alignItems: 'center', gap: Math.round(size * 0.35) } },
    h('img', { src: LOGO_DATA_URI, width: icon, height: icon }),
    h('img', { src: LETTERING_DATA_URI, width: Math.round(height * LETTERING_ASPECT), height }),
  );
}
