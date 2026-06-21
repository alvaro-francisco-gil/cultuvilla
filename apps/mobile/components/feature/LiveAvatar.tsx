import { useMemo } from 'react';
import { getDb, useFirestoreDoc } from '@cultuvilla/shared';
import { userDoc, personDoc, organizationDoc } from '@cultuvilla/shared/firebase/refs/client';
import { Avatar, type AvatarProps } from '../primitives';

/**
 * Owners whose document carries the image we want to render. `user`/`person`
 * expose `photoURL`; `organization` exposes `imageURL`.
 */
export type AvatarOwnerType = 'user' | 'person' | 'organization';

export interface LiveAvatarProps extends Omit<AvatarProps, 'uri'> {
  /** The owner whose image to show. When falsy, only the fallback/initials render. */
  ownerId: string | null | undefined;
  ownerType: AvatarOwnerType;
  /** Optional image shown until — or unless — the owner doc provides one. */
  fallbackUri?: string | null;
}

/**
 * An `Avatar` that live-subscribes to the owner document instead of being handed
 * a URL. Ported from ordago's avatar registry: rather than denormalising a
 * villager's `photoURL` onto every doc that references them (news authors, event
 * organizers, request submitters…), we read it straight from the source doc.
 *
 * Subscriptions are deduped by path in `useFirestoreDoc`, so N `<LiveAvatar>`
 * for the same owner share one Firestore listener, and the picture stays fresh
 * with no denormalisation triggers to maintain. Cultuvilla's rules allow reading
 * `users`/`organizations` (`if true`) and `persons` (`if authenticated`), so the
 * subscribe never hits permission-denied.
 */
export function LiveAvatar({ ownerId, ownerType, fallbackUri, ...rest }: LiveAvatarProps) {
  const ref = useMemo(() => {
    if (!ownerId) return null;
    const db = getDb();
    switch (ownerType) {
      case 'user':
        return userDoc(db, ownerId);
      case 'person':
        return personDoc(db, ownerId);
      case 'organization':
        return organizationDoc(db, ownerId);
      default:
        return null;
    }
  }, [ownerId, ownerType]);

  const { data } = useFirestoreDoc<{ photoURL?: string | null; imageURL?: string | null }>(ref);

  const liveUri =
    ownerType === 'organization' ? (data?.imageURL ?? null) : (data?.photoURL ?? null);

  return <Avatar uri={liveUri ?? fallbackUri ?? null} {...rest} />;
}
