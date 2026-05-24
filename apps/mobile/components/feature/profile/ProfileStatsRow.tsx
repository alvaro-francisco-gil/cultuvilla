import { View } from 'react-native';
import { HStack, Text, VStack } from '../../primitives';

export interface ProfileStat {
  label: string;
  value: number | null;
}

export interface ProfileStatsRowProps {
  stats: ProfileStat[];
}

export function ProfileStatsRow({ stats }: ProfileStatsRowProps) {
  return (
    <HStack className="items-stretch justify-center w-full mt-2 mb-1">
      {stats.map((s, i) => (
        <View key={s.label} className="flex-row flex-1 items-center justify-center">
          {i > 0 ? <View className="w-px bg-subtle mx-2 self-stretch" /> : null}
          <VStack gap={1} className="items-center flex-1">
            <Text variant="h3" className="font-bold">
              {s.value === null ? '—' : String(s.value)}
            </Text>
            <Text variant="caption" tone="muted">
              {s.label}
            </Text>
          </VStack>
        </View>
      ))}
    </HStack>
  );
}
