import logoPng from './logo.png';
import { h, type SatoriNode } from '../h';
import { colors } from '../theme';
import { copy } from '../copy';

/**
 * A downscaled copy of `apps/mobile/assets/logo.png` (160px, transparent). A
 * copy rather than an import across workspaces: the functions bundle is built
 * and uploaded on its own, and the app asset is ten times the size the largest
 * mark here is ever drawn at.
 */
const LOGO_DATA_URI = `data:image/png;base64,${Buffer.from(logoPng).toString('base64')}`;

/** The Cultuvilla icon beside its wordmark, as every card signs off. */
export function brandMark(fontSize: number): SatoriNode {
  const icon = Math.round(fontSize * 1.35);
  return h(
    'div',
    { style: { display: 'flex', alignItems: 'center', gap: Math.round(fontSize * 0.35) } },
    h('img', { src: LOGO_DATA_URI, width: icon, height: icon }),
    h(
      'div',
      { style: { display: 'flex', fontSize, fontWeight: 800, color: colors.accent, letterSpacing: -0.5 } },
      copy.brand,
    ),
  );
}
