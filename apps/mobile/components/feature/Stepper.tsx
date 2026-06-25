// apps/mobile/components/feature/Stepper.tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Dimensions, PanResponder, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Ionicons } from '@expo/vector-icons';
import { Button, HStack, Text } from '../primitives';
import { useT } from '../../lib/i18n';
import { StepIndicator } from './StepIndicator';

/**
 * Decide what a release gesture means for step navigation. Pure so the gesture
 * logic is unit-testable (PanResponder's gesture state can't be driven in jest).
 * A drag must be clearly horizontal — past `threshold` px and more horizontal
 * than vertical — so inner vertical scrolling is never hijacked.
 */
export function classifySwipe(dx: number, dy: number, threshold = 40): 'forward' | 'back' | null {
  if (Math.abs(dx) < threshold) return null;
  if (Math.abs(dx) <= Math.abs(dy)) return null;
  return dx < 0 ? 'forward' : 'back';
}

export interface StepConfig {
  key: string;
  /** Used as the step indicator's accessibility label (dots show no text). */
  title: string;
  /** Ionicons glyph shown in the step indicator. */
  icon?: keyof typeof Ionicons.glyphMap;
  render: () => ReactNode;
  validate?: () => string[];
}

export interface StepperProps {
  steps: StepConfig[];
  onComplete: () => void | Promise<void>;
  submitLabel: string;
  loading?: boolean;
  submitError?: string | null;
  /**
   * Edit mode: the record already exists, so every step is reachable and
   * directly clickable from the start (no forward-validation gate). Defaults
   * to false for create-from-scratch flows.
   */
  allStepsReachable?: boolean;
}

export function Stepper({
  steps,
  onComplete,
  submitLabel,
  loading = false,
  submitError,
  allStepsReachable = false,
}: StepperProps) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(0);
  const [highestReached, setHighestReached] = useState(allStepsReachable ? steps.length - 1 : 0);

  // Slide the incoming step in from the side whenever the step changes — by
  // swipe, Next/Back, or a dot tap. Forward slides in from the right, back from
  // the left. `width` measures the content area so the offset matches the screen.
  const slideX = useRef(new Animated.Value(0)).current;
  const widthRef = useRef(Dimensions.get('window').width);
  const prevCurrent = useRef(current);
  useEffect(() => {
    if (prevCurrent.current === current) return;
    const dir = current > prevCurrent.current ? 1 : -1;
    prevCurrent.current = current;
    slideX.setValue(dir * widthRef.current);
    Animated.timing(slideX, {
      toValue: 0,
      duration: 220,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [current, slideX]);

  // `current` is always a valid index (0..steps.length-1); the non-null assert
  // satisfies tsc's noUncheckedIndexedAccess without a runtime guard.
  const step = steps[current]!;
  const isLast = current === steps.length - 1;
  const stepValid = (step.validate?.() ?? []).length === 0;

  function goTo(index: number) {
    // Edit mode: jump anywhere freely. Otherwise back nav is free, forward nav
    // is gated by progress + current-step validity.
    if (allStepsReachable || index <= current) {
      setCurrent(index);
      return;
    }
    if (index <= highestReached && stepValid) setCurrent(index);
  }

  function handleNext() {
    if (!stepValid) return;
    const next = current + 1;
    setCurrent(next);
    setHighestReached((h) => Math.max(h, next));
  }

  function goBack() {
    if (current > 0) setCurrent(current - 1);
  }

  // Swipe to move between steps. Forward swipe mirrors the Next button (gated by
  // the current step's validity); back swipe mirrors Back. The handlers read
  // `current`/`stepValid` from a ref so the responder, created once, always
  // sees the latest values.
  const swipeRef = useRef({ handleNext, goBack });
  swipeRef.current = { handleNext, goBack };
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_e, g) => {
        const dir = classifySwipe(g.dx, g.dy);
        if (dir === 'forward') swipeRef.current.handleNext();
        else if (dir === 'back') swipeRef.current.goBack();
      },
    }),
  ).current;

  return (
    <View className="flex-1">
      {/* Step band — distinct background, icon-only, no section name. */}
      <View className="bg-surface-elevated">
        <StepIndicator
          count={steps.length}
          current={current}
          highestReached={highestReached}
          onStepPress={goTo}
          icons={steps.map((s) => s.icon)}
          labels={steps.map((s) => s.title)}
          complete={steps.map((s) => (s.validate?.() ?? []).length === 0)}
          allReachable={allStepsReachable}
        />
      </View>
      {/* Content section. Swipe left/right moves between steps; the new step
          slides in. Styles go on `style` — NativeWind drops className here. */}
      <Animated.View
        style={{ flex: 1, transform: [{ translateX: slideX }] }}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) widthRef.current = w;
        }}
        {...panResponder.panHandlers}
      >
        {step.render()}
      </Animated.View>
      {submitError ? <Text tone="danger" className="px-4 pb-2">{submitError}</Text> : null}
      {/* Bottom nav bar. The outer View carries the bottom safe-area inset so the
          buttons never sit under the home indicator / system nav. */}
      <View className="bg-surface-elevated" style={{ paddingBottom: insets.bottom }}>
        <HStack gap={3} className="px-4 py-3">
          <View className="flex-1">
            {current > 0 ? (
              <Button variant="ghost" onPress={goBack} disabled={loading} fullWidth>
                {t('common.stepper.back')}
              </Button>
            ) : null}
          </View>
          <View className="flex-1">
            <Button
              onPress={() => { if (isLast) void onComplete(); else handleNext(); }}
              loading={loading}
              disabled={!stepValid}
              fullWidth
            >
              {isLast ? submitLabel : t('common.stepper.next')}
            </Button>
          </View>
        </HStack>
      </View>
    </View>
  );
}
