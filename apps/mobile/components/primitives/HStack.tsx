import { View } from 'react-native';
import type { ReactNode } from 'react';
import type { SpacingKey } from '@cultuvilla/shared/design-system';

type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
type Justify = 'start' | 'center' | 'end' | 'between' | 'around';

export interface HStackProps {
  children: ReactNode;
  gap?: SpacingKey;
  align?: Align;
  justify?: Justify;
  className?: string;
  testID?: string;
}

const ALIGN: Record<Align, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const JUSTIFY: Record<Justify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
};

// Horizontal stack. `gap` keys come from the spacing scale (SpacingKey, same as
// web's HStack). Mirrors apps/web/components/primitives/HStack.tsx prop API.
export function HStack({
  children,
  gap = 2,
  align,
  justify,
  className = '',
  testID,
}: HStackProps) {
  const parts = [`flex-row gap-${gap}`];
  if (align) parts.push(ALIGN[align]);
  if (justify) parts.push(JUSTIFY[justify]);
  if (className) parts.push(className);
  return (
    <View className={parts.join(' ')} testID={testID}>
      {children}
    </View>
  );
}
