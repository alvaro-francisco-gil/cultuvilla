import { View } from 'react-native';
import type { ReactNode } from 'react';
import type { SpacingKey } from '@cultuvilla/shared/design-system';

type Align = 'start' | 'center' | 'end' | 'stretch';

export interface VStackProps {
  children: ReactNode;
  gap?: SpacingKey;
  align?: Align;
  className?: string;
  testID?: string;
}

const ALIGN: Record<Align, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

// Vertical stack. `gap` keys come from the spacing scale (SpacingKey, same as
// web's VStack). Mirrors apps/web/components/primitives/VStack.tsx prop API.
export function VStack({
  children,
  gap = 3,
  align,
  className = '',
  testID,
}: VStackProps) {
  const parts = [`flex-col gap-${gap}`];
  if (align) parts.push(ALIGN[align]);
  if (className) parts.push(className);
  return (
    <View className={parts.join(' ')} testID={testID}>
      {children}
    </View>
  );
}
