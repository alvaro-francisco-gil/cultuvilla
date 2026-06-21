import { useOwnerSummary, type OwnerType } from '../../lib/useOwnerSummary';
import { Avatar, type AvatarProps } from '../primitives';

/** Re-exported for callers that only need the avatar; see useOwnerSummary. */
export type AvatarOwnerType = OwnerType;

export interface LiveAvatarProps extends Omit<AvatarProps, 'uri'> {
  /** The owner whose image to show. When falsy, only the fallback/initials render. */
  ownerId: string | null | undefined;
  ownerType: OwnerType;
  /** Optional image shown until — or unless — the owner doc provides one. */
  fallbackUri?: string | null;
}

/**
 * An `Avatar` that live-subscribes to the owner document instead of being handed
 * a URL. Ported from ordago's avatar registry: rather than denormalising a
 * villager's `photoURL` onto every doc that references them (news authors, event
 * organizers, request submitters…), we read it straight from the source doc.
 * See docs/architecture/live-references.md.
 *
 * When no explicit `initials` are passed, they're derived from the live name.
 */
export function LiveAvatar({ ownerId, ownerType, fallbackUri, initials, ...rest }: LiveAvatarProps) {
  const { name, imageUri } = useOwnerSummary(ownerId, ownerType);
  const resolvedInitials = initials ?? (name ? name.slice(0, 1).toUpperCase() : undefined);
  return <Avatar uri={imageUri ?? fallbackUri ?? null} initials={resolvedInitials} {...rest} />;
}
