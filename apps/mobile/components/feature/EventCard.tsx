import { FeedCard } from './FeedCard';
import { formatDate } from '@cultuvilla/shared/utils';

/**
 * Minimal event shape consumed by this card.
 * Callers using real EventData should map:
 *   startDate  → startDate  (already a Date from mapEventDoc)
 *   organizationName → organizationName
 *   imageURL → imageURL     (cover image, optional)
 */
export type EventLike = {
  id: string;
  title: string;
  startDate: Date;
  organizationName: string;
  imageURL?: string | null;
  /** Village cover photo, used as the fallback when the event has no image. */
  municipalityCoverImage?: string | null;
};

export type EventCardProps = {
  event: EventLike;
  onPress: (id: string) => void;
  badge?: string | null;
  testID?: string;
};

export function EventCard({ event, onPress, badge, testID }: EventCardProps) {
  return (
    <FeedCard
      imageUri={event.imageURL ?? null}
      fallbackImageUri={event.municipalityCoverImage ?? null}
      title={event.title}
      metaLeft={event.organizationName}
      metaRight={formatDate(event.startDate, 'short')}
      fallbackIcon="calendar-outline"
      badge={badge}
      onPress={() => onPress(event.id)}
      testID={testID}
    />
  );
}
