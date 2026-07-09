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
  onPress: () => void;
};

/** A tappable fact card (when / where), styled after ordago's TournamentDetails
 * info cards: an accent icon + uppercase accent label above the value on a
 * single line, with a chevron centred vertically at the right edge. */
export function DetailInfoCard({ icon, label, value, onPress }: DetailInfoCardProps) {
  return (
    <Pressable onPress={onPress} className="flex-1">
      <Card className="h-full">
        <HStack gap={2} align="center">
          <VStack gap={1} className="flex-1">
            <HStack gap={2} align="center">
              <Ionicons name={icon} size={iconSizes.md} color={colors.light.fg.accent} />
              <Text
                variant="caption"
                className="flex-1 font-bold"
                style={{ color: colors.light.fg.accent, textTransform: 'uppercase', letterSpacing: 0.8 }}
              >
                {label}
              </Text>
            </HStack>
            <Text variant="h3" numberOfLines={1}>{value}</Text>
          </VStack>
          <Ionicons name="chevron-forward" size={iconSizes.sm} color={colors.light.fg.muted} />
        </HStack>
      </Card>
    </Pressable>
  );
}
