import { View } from 'react-native';
import { Text } from '../primitives/Text';
import { elevation } from '@cultuvilla/shared/design-system';

/**
 * A diagonal band across the top-left corner of a feed card's image.
 *
 * The geometry is fixed for every variant on purpose. Letting the corner grow
 * to fit its label would give "Apuntado" and "Apuntados ×3" different-sized
 * triangles, and a column of cards would read as broken. Instead the band is
 * constant and the labels are sized to fit it:
 *
 *   - the clip is a CLIP × CLIP square pinned to the corner;
 *   - the band's centre line sits at x + y = CENTRE_SUM, which the corner's
 *     right angle turns into a visible chord of CENTRE_SUM · √2 ≈ 116px;
 *   - the band overshoots the clip at both ends so it reads as a ribbon
 *     passing behind the card, not a triangle pasted onto it.
 *
 * `tone: 'split'` paints the two halves separately — the top row terracotta,
 * the bottom olive — so that in the mixed state the colour *is* the row it
 * labels rather than decoration next to it.
 */

const CLIP = 118;
const CENTRE_SUM = 82;
const BAND_WIDTH = 210;
// Both variants centre the band at (41, 41), so only `top` shifts as the band
// grows a second line. See CENTRE_SUM above.
const BAND_LEFT = 41 - BAND_WIDTH / 2;
const ROW_PADDING = 5;
const CAPTION_LINE_HEIGHT = 16; // typography.caption
const SINGLE_TOP = 41 - (CAPTION_LINE_HEIGHT + ROW_PADDING * 2) / 2;
const SPLIT_TOP = 41 - (CAPTION_LINE_HEIGHT * 2 + ROW_PADDING * 2) / 2;

export type CornerRibbonTone = 'accent' | 'secondary' | 'split';

export type CornerRibbonProps = {
  /** One line, or two when `tone` is 'split' (top line first). */
  lines: [string] | [string, string];
  tone: CornerRibbonTone;
  testID?: string;
};

const LABEL_STYLE = {
  textAlign: 'center' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
  fontWeight: '700' as const,
};

export function CornerRibbon({ lines, tone, testID }: CornerRibbonProps) {
  const split = tone === 'split';
  const [first, second] = lines;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: CLIP,
        height: CLIP,
        overflow: 'hidden',
      }}
      pointerEvents="none"
      testID={testID}
    >
      <View
        style={{
          position: 'absolute',
          left: BAND_LEFT,
          top: split ? SPLIT_TOP : SINGLE_TOP,
          width: BAND_WIDTH,
          transform: [{ rotate: '-45deg' }],
          ...elevation.sm.rn,
        }}
      >
        <View
          className={tone === 'secondary' ? 'bg-secondary' : 'bg-accent'}
          style={{ paddingTop: ROW_PADDING, paddingBottom: split ? 0 : ROW_PADDING }}
        >
          <Text variant="caption" tone="onAccent" numberOfLines={1} style={LABEL_STYLE}>
            {first}
          </Text>
        </View>
        {split && second ? (
          <View className="bg-secondary" style={{ paddingBottom: ROW_PADDING }}>
            <Text variant="caption" tone="onSecondary" numberOfLines={1} style={LABEL_STYLE}>
              {second}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
