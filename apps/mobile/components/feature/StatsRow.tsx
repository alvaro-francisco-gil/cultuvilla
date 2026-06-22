import { View } from 'react-native';
import { HStack, Text, VStack } from '../primitives';

export interface StatItem {
  label: string;
  value: number | null;
}

/**
 * Shared three-up stats row used by both the pueblo (village) and profile
 * screens so the numbers line up in the same place across a tab switch.
 * Equal-width columns, a hero number (`h2`, bold) over a muted label, with
 * full-height hairline separators between columns.
 */
export function StatsRow({ stats }: { stats: StatItem[] }) {
  return (
    <HStack className="items-stretch justify-center w-full">
      {stats.map((s, i) => (
        <View key={s.label} className="flex-row flex-1 items-center justify-center">
          {i > 0 ? <View className="w-px h-8 bg-subtle mx-2" /> : null}
          <VStack gap={1} className="items-center flex-1">
            <Text variant="h2" className="font-bold">
              {s.value === null ? '—' : String(s.value)}
            </Text>
            <Text variant="bodySm" tone="muted">
              {s.label}
            </Text>
          </VStack>
        </View>
      ))}
    </HStack>
  );
}
