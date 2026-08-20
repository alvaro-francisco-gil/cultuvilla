import { FeedCard } from './FeedCard';
import type { CornerRibbonProps } from './CornerRibbon';
import { useT } from '../../lib/i18n';
import type { I18n } from '../../lib/i18n';
import { relativeDayLabel } from '../../lib/relativeDayLabel';
import type { RegistrationRibbon } from '@cultuvilla/shared/models/event/RegistrationRibbonModel';

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
  commentCount?: number;
  /** Server-maintained count of confirmed event registrations. */
  confirmedCount?: number;
};

export type EventCardProps = {
  event: EventLike;
  onPress: (id: string) => void;
  badge?: string | null;
  /**
   * The viewer's own registrations on this event, resolved by
   * `resolveRegistrationRibbon`. `null` (the common case) draws no ribbon.
   */
  registration?: RegistrationRibbon | null;
  testID?: string;
};

/**
 * The ribbon's Spanish surface. Singular when it is one person, plural with the
 * count when it is more; the mixed state splits into two lines so each count
 * stays attached to its own status.
 */
export function registrationRibbonProps(
  ribbon: RegistrationRibbon,
  t: I18n['t'],
): CornerRibbonProps {
  if (ribbon.kind === 'mixed') {
    return {
      tone: 'split',
      lines: [
        t('event.ribbon.confirmedCount', { count: ribbon.confirmed }),
        t('event.ribbon.waitlistedCount', { count: ribbon.waitlisted }),
      ],
      testID: 'event-card-ribbon',
    };
  }
  const many = ribbon.count > 1;
  if (ribbon.kind === 'confirmed') {
    return {
      tone: 'accent',
      lines: [many ? t('event.ribbon.confirmedMany', { count: ribbon.count }) : t('event.ribbon.confirmed')],
      testID: 'event-card-ribbon',
    };
  }
  return {
    tone: 'secondary',
    lines: [many ? t('event.ribbon.waitlistedMany', { count: ribbon.count }) : t('event.ribbon.waitlisted')],
    testID: 'event-card-ribbon',
  };
}

export function EventCard({ event, onPress, badge, registration, testID }: EventCardProps) {
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
      cornerRibbon={registration ? registrationRibbonProps(registration, t) : null}
      statBadge={
        event.confirmedCount != null
          ? { icon: 'person-outline', count: event.confirmedCount, testID: 'event-card-attendee-count' }
          : undefined
      }
      onPress={() => onPress(event.id)}
      testID={testID}
    />
  );
}
