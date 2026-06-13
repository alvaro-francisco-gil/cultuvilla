import { Ionicons } from '@expo/vector-icons';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';

// Inlined from the design tokens (packages/shared/src/design-system/tokens/colors.ts):
//   accent   = palette.terracotta (#bb5d3a)
//   on-accent = palette.cream     (#f9f0e8)
// Pills are an Animated-free, inline-styled primitive so the ordago-style
// border/active-fill renders identically on the web build (NativeWind would
// otherwise be fine here, but matching ordago's exact pill metrics is easier
// in one place with raw style values).
const ACCENT = '#bb5d3a';
const ON_ACCENT = '#f9f0e8';
const SURFACE_ELEVATED = '#ffffff';

/**
 * Fixed pill height shared by every filter control (including the inline
 * search box) so the row keeps a constant height whether a pill shows a Text
 * label or a focused TextInput — a TextInput's intrinsic height is taller and
 * grows on focus, which would otherwise make the row jump.
 */
export const FILTER_PILL_HEIGHT = 36;

export type FilterPillProps = {
  label: string;
  /** Filled-accent appearance when the filter holds a non-default value. */
  active: boolean;
  onPress: () => void;
  /** Hide the trailing chevron (e.g. for a toggle pill that opens no sheet). */
  hideChevron?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
};

export function FilterPill({
  label,
  active,
  onPress,
  hideChevron = false,
  icon,
  testID,
}: FilterPillProps) {
  const fg = active ? ON_ACCENT : ACCENT;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? ACCENT : SURFACE_ELEVATED,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: ACCENT,
        height: FILTER_PILL_HEIGHT,
        paddingHorizontal: 16,
        marginRight: 8,
      }}
    >
      {icon ? (
        <Ionicons name={icon} size={15} color={fg} style={{ marginRight: 6 }} />
      ) : null}
      <Text variant="bodySm" style={{ color: fg, fontWeight: '700', marginRight: hideChevron ? 0 : 4 }}>
        {label}
      </Text>
      {hideChevron ? null : <Ionicons name="chevron-down" size={15} color={fg} />}
    </Pressable>
  );
}
