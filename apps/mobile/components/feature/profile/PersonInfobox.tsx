import { View } from 'react-native';
import { HStack, Text, VStack } from '../../primitives';

export interface PersonInfoboxRow {
  label: string;
  value: string;
}

/**
 * Wikipedia-style fact table for the read-only person card: one label/value row
 * per known fact, in a bordered block under the name. Rows with nothing to say
 * are dropped by the caller, and the whole block disappears when none are left
 * — an infobox of empty labels reads as missing data rather than a private
 * person who simply hasn't filled anything in.
 */
export function PersonInfobox({ rows }: { rows: PersonInfoboxRow[] }) {
  if (rows.length === 0) return null;

  return (
    <View className="mx-4 mt-4 rounded-md border border-subtle bg-surface">
      <VStack>
        {rows.map((row, index) => (
          <HStack
            key={row.label}
            gap={3}
            align="start"
            className={`px-3 py-2.5 ${index > 0 ? 'border-t border-subtle' : ''}`}
          >
            <Text variant="bodySm" tone="muted" className="w-28">
              {row.label}
            </Text>
            <Text variant="bodySm" className="flex-1">
              {row.value}
            </Text>
          </HStack>
        ))}
      </VStack>
    </View>
  );
}
