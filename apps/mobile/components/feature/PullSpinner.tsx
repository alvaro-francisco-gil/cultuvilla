import { ActivityIndicator, Animated, View } from 'react-native';

const ACCENT = '#bb5d3a'; // colors.ts: light.bg.accent (terracotta)

/**
 * Spinner revealed in the gap that opens above the content as a scroller is
 * pulled down for the web pull-to-refresh gesture. Rides with the same offset
 * the content wrapper uses, and fades in as the pull approaches the trigger.
 *
 * `style` (not className) — NativeWind drops className on Animated.View (see the
 * mobile-web-compat notes). Shared by the feed lists and every entity detail
 * screen (via EntityDetailScaffold), so the pull affordance looks identical.
 */
export function PullSpinner({ pull, top }: { pull: Animated.Value; top: number }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        marginTop: -44,
        alignItems: 'center',
        zIndex: 5,
        opacity: pull.interpolate({ inputRange: [0, 40], outputRange: [0, 1], extrapolate: 'clamp' }),
        transform: [{ translateY: pull }],
      }}
    >
      <View className="rounded-full bg-white p-2 shadow-sm">
        <ActivityIndicator size="small" color={ACCENT} />
      </View>
    </Animated.View>
  );
}
