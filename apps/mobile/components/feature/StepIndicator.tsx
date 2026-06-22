// apps/mobile/components/feature/StepIndicator.tsx
import { Fragment } from 'react';
import { View } from 'react-native';
import { Pressable, Text } from '../primitives';

export interface StepIndicatorProps {
  count: number;
  current: number;
  highestReached: number;
  onStepPress: (index: number) => void;
}

export function StepIndicator({ count, current, highestReached, onStepPress }: StepIndicatorProps) {
  return (
    <View className="flex-row items-center px-5 py-4">
      {Array.from({ length: count }, (_, i) => {
        const reached = i <= highestReached;
        const active = i <= current;
        return (
          <Fragment key={i}>
            <Pressable
              testID={`step-dot-${i}`}
              disabled={!reached}
              onPress={() => onStepPress(i)}
              className={`w-8 h-8 rounded-full border items-center justify-center ${
                active ? 'bg-accent border-accent' : 'bg-subtle border-subtle'
              }`}
            >
              <Text variant="bodySm" tone={active ? 'onAccent' : 'muted'}>
                {String(i + 1)}
              </Text>
            </Pressable>
            {i < count - 1 && (
              <View className={`flex-1 h-0.5 mx-2 ${i < current ? 'bg-accent' : 'bg-subtle'}`} />
            )}
          </Fragment>
        );
      })}
    </View>
  );
}
