import { FeedCard } from './FeedCard';
import { useT } from '../../lib/i18n';
import { relativeDayLabel } from '../../lib/relativeDayLabel';

/**
 * Minimal event shape consumed by this card.
 * Callers using real EventData should map:
 *   startDate       → startDate        (already a Date from mapEventDoc)
 *   locationName    → location.displayName
 *   imageURL        → imageURL         (cover image, optional)
 */
export type EventLike = {
  id: string;
  title: string;
  startDate: Date;
  /** Display name of the event location (shown as left meta). */
  locationName?: string | null;
  imageURL?: string | null;
  /** Village cover photo, used as the fallback when the event has no image. */
  villageCoverImage?: string | null;
};

export type EventCardProps = {
  event: EventLike;
  onPress: (id: string) => void;
  badge?: string | null;
  testID?: string;
};

export function EventCard({ event, onPress, badge, testID }: EventCardProps) {
  const { t } = useT();
  return (
    <FeedCard
      imageUri={event.imageURL ?? null}
      fallbackImageUri={event.villageCoverImage ?? null}
      title={event.title}
      metaLeft={event.locationName ?? null}
      metaRight={relativeDayLabel(event.startDate, t)}
      fallbackIcon="calendar-outline"
      badge={badge}
      onPress={() => onPress(event.id)}
      testID={testID}
    />
  );
}
