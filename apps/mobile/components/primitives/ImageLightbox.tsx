import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable as RNPressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { iconSizes } from '@cultuvilla/shared/design-system';
import { RemoteImage } from './RemoteImage';
import {
  MIN_SCALE,
  clampOffset,
  clampScale,
  dismissBackdropOpacity,
  fitSize,
  isDoubleTap,
  nextScaleOnDoubleTap,
  offsetForScaleAbout,
  pinchScale,
  shouldDismissOnRelease,
  touchDistance,
  touchMidpoint,
  type Offset,
  type Size,
} from '../../lib/imageZoom';

/**
 * Full-screen image viewer: pinch to zoom, drag to pan, double-tap to toggle
 * between fit and 3x, swipe down (or ✕) to dismiss.
 *
 * Built on core `Animated` + `PanResponder` rather than
 * gesture-handler/reanimated, which this app does not depend on. Adding them
 * would change the native fingerprint, and an OTA update cannot carry native
 * code — a zoom that only reaches users through a new store binary is a zoom
 * nobody has. All the geometry lives in `lib/imageZoom.ts` so it stays
 * unit-testable; this file is the wiring.
 *
 * The viewer requests the `original` rendition: zooming into the downscaled
 * `card` variant the surrounding screen renders would only magnify mush.
 *
 * Styles go on `style`, never `className` — NativeWind drops className on
 * `Animated.View` in the web build.
 */
export type ImageLightboxProps = {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
  /** Accessibility label for the ✕ button. */
  closeLabel: string;
  accessibilityLabel?: string;
};

export function ImageLightbox({
  uri,
  visible,
  onClose,
  closeLabel,
  accessibilityLabel,
}: ImageLightboxProps) {
  const { width, height } = useWindowDimensions();
  // Read the context directly rather than through `useSafeAreaInsets`, which
  // throws when no provider is above it. The viewer is mounted from leaf image
  // components all over the app (and from tests that render one in isolation);
  // a missing provider should cost the ✕ button its inset, not crash the screen.
  const insets = useContext(SafeAreaInsetsContext);
  const topInset = insets?.top ?? 0;
  const viewport = useMemo(() => ({ width, height }), [width, height]);

  const [natural, setNatural] = useState<Size | null>(null);
  const displayed = useMemo(
    () => fitSize(natural ?? viewport, viewport),
    [natural, viewport],
  );

  const scaleAnim = useRef(new Animated.Value(MIN_SCALE)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(1)).current;

  // Imperative mirror of the animated values: PanResponder callbacks need the
  // current numbers synchronously, and reading an Animated.Value's internals is
  // not part of its API.
  const gesture = useRef({
    scale: MIN_SCALE,
    offset: { x: 0, y: 0 } as Offset,
    startScale: MIN_SCALE,
    startOffset: { x: 0, y: 0 } as Offset,
    pinchDistance: 0,
    pinching: false,
    lastTapAt: 0,
  });

  const reset = useCallback(() => {
    gesture.current.scale = MIN_SCALE;
    gesture.current.offset = { x: 0, y: 0 };
    gesture.current.pinching = false;
    gesture.current.lastTapAt = 0;
    scaleAnim.setValue(MIN_SCALE);
    translateX.setValue(0);
    translateY.setValue(0);
    backdrop.setValue(1);
  }, [backdrop, scaleAnim, translateX, translateY]);

  // A reopened viewer must start fitted, not wherever the last pinch left it.
  useEffect(() => {
    if (visible) reset();
  }, [visible, reset]);

  useEffect(() => {
    setNatural(null);
  }, [uri]);

  const applyOffset = useCallback(
    (offset: Offset, scale: number) => {
      const clamped = clampOffset(offset, displayed, viewport, scale);
      gesture.current.offset = clamped;
      translateX.setValue(clamped.x);
      translateY.setValue(clamped.y);
    },
    [displayed, viewport, translateX, translateY],
  );

  const zoomTo = useCallback(
    (scale: number, focal: Offset) => {
      const next = clampScale(scale);
      const offset =
        next === MIN_SCALE
          ? { x: 0, y: 0 }
          : offsetForScaleAbout(focal, gesture.current.offset, gesture.current.scale, next);
      gesture.current.scale = next;
      applyOffset(offset, next);
      Animated.spring(scaleAnim, {
        toValue: next,
        useNativeDriver: true,
        friction: 8,
        tension: 90,
      }).start();
    },
    [applyOffset, scaleAnim],
  );

  /** Touch coordinates relative to the viewport centre, as the geometry expects. */
  const toFocal = useCallback(
    (pageX: number, pageY: number): Offset => ({
      x: pageX - viewport.width / 2,
      y: pageY - viewport.height / 2,
    }),
    [viewport],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3 || gesture.current.scale > MIN_SCALE,

        onPanResponderGrant: (e: GestureResponderEvent) => {
          const now = Date.now();
          const { pageX, pageY } = e.nativeEvent;
          if (isDoubleTap(gesture.current.lastTapAt, now)) {
            gesture.current.lastTapAt = 0;
            zoomTo(nextScaleOnDoubleTap(gesture.current.scale), toFocal(pageX, pageY));
          } else {
            gesture.current.lastTapAt = now;
          }
          gesture.current.startScale = gesture.current.scale;
          gesture.current.startOffset = gesture.current.offset;
          gesture.current.pinching = false;
        },

        onPanResponderMove: (e: GestureResponderEvent, g: PanResponderGestureState) => {
          const touches = e.nativeEvent.touches;
          const first = touches[0];
          const second = touches[1];
          if (first && second) {
            const a = { x: first.pageX, y: first.pageY };
            const b = { x: second.pageX, y: second.pageY };
            const distance = touchDistance(a, b);
            if (!gesture.current.pinching) {
              // A pinch can begin mid-drag, so re-anchor rather than assuming
              // the values recorded at grant time.
              gesture.current.pinching = true;
              gesture.current.pinchDistance = distance;
              gesture.current.startScale = gesture.current.scale;
              gesture.current.startOffset = gesture.current.offset;
              backdrop.setValue(1);
            }
            const next = pinchScale(
              gesture.current.startScale,
              gesture.current.pinchDistance,
              distance,
            );
            const mid = touchMidpoint(a, b);
            const focal = toFocal(mid.x, mid.y);
            gesture.current.scale = next;
            scaleAnim.setValue(next);
            applyOffset(
              offsetForScaleAbout(
                focal,
                gesture.current.startOffset,
                gesture.current.startScale,
                next,
              ),
              next,
            );
            return;
          }

          if (gesture.current.pinching) return;

          if (gesture.current.scale > MIN_SCALE) {
            applyOffset(
              {
                x: gesture.current.startOffset.x + g.dx,
                y: gesture.current.startOffset.y + g.dy,
              },
              gesture.current.scale,
            );
            return;
          }

          // Fitted: a vertical drag is the dismiss gesture, tracked by the
          // image itself so the picture follows the finger.
          translateY.setValue(g.dy);
          backdrop.setValue(dismissBackdropOpacity(g.dy, viewport.height));
        },

        onPanResponderRelease: (_e, g) => {
          if (gesture.current.pinching) {
            gesture.current.pinching = false;
            if (gesture.current.scale <= MIN_SCALE) zoomTo(MIN_SCALE, { x: 0, y: 0 });
            return;
          }
          if (shouldDismissOnRelease(g.dy, g.vy, gesture.current.scale)) {
            onClose();
            return;
          }
          if (gesture.current.scale <= MIN_SCALE) {
            Animated.parallel([
              Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
              Animated.timing(backdrop, { toValue: 1, duration: 140, useNativeDriver: true }),
            ]).start();
            gesture.current.offset = { x: 0, y: 0 };
          }
        },

        onPanResponderTerminate: () => {
          gesture.current.pinching = false;
        },
      }),
    [applyOffset, backdrop, onClose, scaleAnim, toFocal, translateY, viewport.height, zoomTo],
  );

  if (!uri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdrop }]} />
        <Animated.View
          style={[
            styles.stage,
            {
              transform: [
                { translateX },
                { translateY },
                { scale: scaleAnim },
              ],
            },
          ]}
          testID="image-lightbox-stage"
          {...panResponder.panHandlers}
        >
          <RemoteImage
            uri={uri}
            variant="original"
            style={{ width: displayed.width, height: displayed.height }}
            contentFit="contain"
            onNaturalSize={(w, h) => { setNatural({ width: w, height: h }); }}
            accessibilityLabel={accessibilityLabel}
            testID="image-lightbox-image"
          />
        </Animated.View>
        <RNPressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          testID="image-lightbox-close"
          style={[styles.close, { top: topInset + 8 }]}
        >
          <Ionicons name="close" size={iconSizes.md} color="#ffffff" />
        </RNPressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: { backgroundColor: '#000000' },
  stage: { alignItems: 'center', justifyContent: 'center' },
  close: {
    position: 'absolute',
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
