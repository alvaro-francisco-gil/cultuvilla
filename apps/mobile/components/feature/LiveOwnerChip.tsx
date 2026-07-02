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
  /**
   * Explicit image to show instead of the resolved one. Use for `user` owners,
   * whose avatar lives on the linked person doc (the user doc's `photoURL` is
   * frequently null). `undefined` keeps the live-resolved image; `null` forces
   * initials.
   */
  imageUri?: string | null;
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
  imageUri,
}: LiveOwnerChipProps) {
  const { name, imageUri: resolvedImageUri } = useOwnerSummary(ownerId, ownerType);
  const label = name ?? fallbackName ?? '';
  const initials = label ? label.slice(0, 1).toUpperCase() : undefined;
  const shownImage = imageUri !== undefined ? imageUri : resolvedImageUri;
  return (
    <HStack gap={2} align="center">
      <Avatar uri={shownImage} size={size} initials={initials} />
      <Text tone={tone} numberOfLines={1} className="shrink">
        {prefix ? `${prefix}${label}` : label}
      </Text>
    </HStack>
  );
}
