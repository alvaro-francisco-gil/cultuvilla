import { View } from 'react-native';
import type { ReactNode } from 'react';

type Variant = 'flat' | 'elevated';

export interface CardProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  testID?: string;
}

const VARIANT_CLASS: Record<Variant, string> = {
  flat: 'bg-surface border border-subtle',
  elevated: 'bg-surface-elevated shadow-sm',
};

// Container primitive. Mirrors apps/web/components/primitives/Card.tsx prop API
// (variant: 'flat' | 'elevated'). Padding and child layout are the caller's
// responsibility — wrap with <VStack gap={3}> inside if you want typical card layout.
export function Card({
  children,
  variant = 'flat',
  className = '',
  testID,
}: CardProps) {
  const parts = ['rounded-lg p-4', VARIANT_CLASS[variant]];
  if (className) parts.push(className);
  return (
    <View className={parts.join(' ')} testID={testID}>
      {children}
    </View>
  );
}
