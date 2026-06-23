// apps/mobile/components/feature/Stepper.tsx
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { Ionicons } from '@expo/vector-icons';
import { Button, HStack, Text } from '../primitives';
import { useT } from '../../lib/i18n';
import { StepIndicator } from './StepIndicator';

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
  const [current, setCurrent] = useState(0);
  const [highestReached, setHighestReached] = useState(allStepsReachable ? steps.length - 1 : 0);

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
      {/* Content section. */}
      <View className="flex-1">{step.render()}</View>
      {submitError ? <Text tone="danger" className="px-4 pb-2">{submitError}</Text> : null}
      <HStack gap={3} className="px-4 py-3 bg-surface-elevated">
        <View className="flex-1">
          {current > 0 ? (
            <Button variant="ghost" onPress={() => setCurrent(current - 1)} disabled={loading} fullWidth>
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
  );
}
