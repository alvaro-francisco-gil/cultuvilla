import { Ionicons } from '@expo/vector-icons';
import { VStack } from '../primitives/VStack';
import { HStack } from '../primitives/HStack';
import { Text } from '../primitives/Text';
import { Card } from '../primitives/Card';
import { Pressable } from '../primitives/Pressable';
import { colors, iconSizes } from '@cultuvilla/shared/design-system';

export type DetailInfoCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  detail?: string;
  action: string;
  onPress: () => void;
};

/** A tappable "rectangle" summarising one fact (when / where) with a link out.
 * Promoted from the event detail screen so every entity can share it. */
export function DetailInfoCard({ icon, label, value, detail, action, onPress }: DetailInfoCardProps) {
  return (
    <Pressable onPress={onPress} className="flex-1">
      <Card className="h-full">
        <VStack gap={1}>
          <HStack gap={2} align="center">
            <Ionicons name={icon} size={iconSizes.md} color={colors.light.fg.accent} />
            <Text variant="caption" tone="muted">{label}</Text>
          </HStack>
          <Text variant="h3" numberOfLines={2}>{value}</Text>
          {detail ? <Text tone="muted">{detail}</Text> : null}
          <Text variant="caption" className="text-accent">{`${action} →`}</Text>
        </VStack>
      </Card>
    </Pressable>
  );
}
