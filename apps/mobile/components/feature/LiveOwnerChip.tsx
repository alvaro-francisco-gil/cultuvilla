import { Avatar } from '../primitives';
import { HStack } from '../primitives/HStack';
import { Text } from '../primitives/Text';
import { useOwnerSummary, type OwnerType } from '../../lib/useOwnerSummary';

export interface LiveOwnerChipProps {
  /** The owner to resolve. When falsy, the fallback name + initials render. */
  ownerId: string | null | undefined;
  ownerType: OwnerType;
  size?: number;
  /** Shown (and used for initials) until — or unless — the owner doc provides a name. */
  fallbackName?: string;
  tone?: 'primary' | 'muted';
  /** Prefix shown before the name, e.g. "Por " for a news byline. */
  prefix?: string;
}

/**
 * Avatar + live name for an owner reference (a stored id, not a copied name).
 * Subscribes to the source doc via `useOwnerSummary`, so the same admin/byline
 * surfaces that used to print a raw uid now show a current face + display name,
 * with no denormalisation. See docs/architecture/live-references.md.
 */
export function LiveOwnerChip({
  ownerId,
  ownerType,
  size = 36,
  fallbackName,
  tone = 'primary',
  prefix,
}: LiveOwnerChipProps) {
  const { name, imageUri } = useOwnerSummary(ownerId, ownerType);
  const label = name ?? fallbackName ?? '';
  const initials = label ? label.slice(0, 1).toUpperCase() : undefined;
  return (
    <HStack gap={2} align="center">
      <Avatar uri={imageUri} size={size} initials={initials} />
      <Text tone={tone} numberOfLines={1} className="shrink">
        {prefix ? `${prefix}${label}` : label}
      </Text>
    </HStack>
  );
}
