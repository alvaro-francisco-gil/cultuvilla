import { useOwnerSummary } from '../../lib/useOwnerSummary';
import { PersonCard } from './VillageSections';

export interface LivePersonCardProps {
  userId: string;
  /** Optional accent badge, e.g. the "pending join request" label. */
  badge?: string;
  onPress?: () => void;
}

/**
 * A `PersonCard` that live-resolves its name + photo from the user doc instead
 * of being handed pre-fetched values. Replaces the per-person `getUserProfile`
 * join the village screens used to run (one round-trip each, stale on screen):
 * the screen now passes only userIds and the cards subscribe — deduped by path,
 * always fresh. See docs/architecture/live-references.md.
 */
export function LivePersonCard({ userId, badge, onPress }: LivePersonCardProps) {
  const { name, imageUri } = useOwnerSummary(userId, 'user');
  return <PersonCard name={name ?? ''} photoURL={imageUri} badge={badge} onPress={onPress} />;
}
