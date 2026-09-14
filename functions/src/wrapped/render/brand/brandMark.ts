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

/**
 * The Cultuvilla lettering, optionally led by the icon. `size` is the
 * lettering's height; `icon` is the icon's own size in pixels. Only the cover
 * carries the icon — on the other cards the lettering signs off alone.
 */
export function brandMark(size: number, options: { icon?: number } = {}): SatoriNode {
  const height = Math.round(size);
  const lettering = h('img', { src: LETTERING_DATA_URI, width: Math.round(height * LETTERING_ASPECT), height });
  if (options.icon === undefined) return lettering;
  return h(
    'div',
    { style: { display: 'flex', alignItems: 'center', gap: Math.round(size * 0.6) } },
    h('img', { src: LOGO_DATA_URI, width: options.icon, height: options.icon }),
    lettering,
  );
}
