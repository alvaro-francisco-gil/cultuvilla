import { Avatar } from '../primitives';
import { HStack } from '../primitives/HStack';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { useOwnerSummary } from '../../lib/useOwnerSummary';

export interface LivePersonChipProps {
  /** The person to resolve. When falsy, the fallback name + initials render. */
  personId: string | null | undefined;
  size?: number;
  /** Shown (and used for initials) until — or unless — the person doc provides a name. */
  fallbackName?: string;
  /** When provided, the whole chip is tappable (e.g. to open the person's screen). */
  onPress?: () => void;
}

/**
 * Avatar + live name for a person reference — the same circular-avatar-plus-name
 * chip `LiveOwnerChip` renders for event organizers, sized for a wrapping row of
 * residents rather than the full-bleed `PersonCard`. Subscribes to the person
 * doc via `useOwnerSummary('person', …)`, mirroring how `LivePersonCard`
 * resolves the same data for its card layout.
 */
export function LivePersonChip({ personId, size = 36, fallbackName, onPress }: LivePersonChipProps) {
  const { name, imageUri } = useOwnerSummary(personId, 'person');
  const label = name ?? fallbackName ?? '';
  const initials = label ? label.slice(0, 1).toUpperCase() : undefined;
  const content = (
    <HStack gap={2} align="center">
      <Avatar uri={imageUri} size={size} initials={initials} />
      <Text numberOfLines={1} className="shrink">
        {label}
      </Text>
    </HStack>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label || undefined}>
      {content}
    </Pressable>
  );
}
