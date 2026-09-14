import { z } from 'zod';

/**
 * A village's post-fiestas summary for one fiesta block in one year.
 *
 * Stored at `villageWrapped/{municipalityId}_{year}_{blockId}` — the id is
 * deterministic so recomputing overwrites in place rather than duplicating.
 *
 * The doc holds STATS and the rendered image paths, never the raw people or
 * event lists it was built from. Those are inputs to rendering; copying them
 * here would duplicate `municipalityPeople` and go stale the moment someone
 * changes their photo.
 */

/** In the order they are shown. Carteles close the set: this year added to the pueblo's long history. */
export const WRAPPED_CARDS = ['cover', 'stats', 'events', 'people', 'organizers', 'posters'] as const;
export const WrappedCardSchema = z.enum([...WRAPPED_CARDS]);
export type WrappedCard = z.infer<typeof WrappedCardSchema>;

export const WRAPPED_STATUSES = ['draft', 'published', 'discarded'] as const;
export const WrappedStatusSchema = z.enum([...WRAPPED_STATUSES]);
export type WrappedStatus = z.infer<typeof WrappedStatusSchema>;

export const WrappedStatsSchema = z.object({
  /** Live events inside the window — cancelled ones never count. */
  eventCount: z.number().int(),
  /** Sign-ups, never attendance: `checkedInAt` is unused, so nothing here can claim who turned up. */
  confirmedCount: z.number().int(),
  waitlistedCount: z.number().int(),
  /** Distinct personas. The headline participation figure — families sign up
   *  several personas each, so summing registrations overstates it badly. */
  uniquePersonCount: z.number().int(),
  /** Distinct accounts behind those personas — a household, not a participant. */
  uniqueAccountCount: z.number().int(),
  commentCount: z.number().int(),
  /** People in the censo. */
  censoCount: z.number().int(),
  /** Participants who are IN the censo — the only figure that may be read
   *  against `censoCount`. `uniquePersonCount` also includes personas with no
   *  village link and people from elsewhere, so "N of censoCount" using it is
   *  a false ratio. */
  censoParticipantCount: z.number().int(),
  posterCount: z.number().int(),
});
export type WrappedStats = z.infer<typeof WrappedStatsSchema>;

/** Bounds for the credits card. Big enough that a real village's organizers
 *  all appear (Matabuena's August had 3 orgs and 10 people), small enough to lay out. */
export const MAX_ORG_CREDITS = 6;
export const MAX_PERSON_CREDITS = 12;

export const WrappedEventHighlightSchema = z.object({
  eventId: z.string(),
  title: z.string(),
  count: z.number().int(),
  capacity: z.number().int().nullable(),
});

export const WrappedOrgCreditSchema = z.object({
  organizationId: z.string(),
  name: z.string(),
  eventCount: z.number().int(),
  imageURL: z.string().nullable(),
});

export const WrappedPersonCreditSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  eventCount: z.number().int(),
  photoURL: z.string().nullable(),
});

export const WrappedDataSchema = z.object({
  municipalityId: z.string(),
  villageName: z.string(),
  year: z.number().int(),
  blockId: z.string(),
  blockName: z.string(),
  windowStart: z.date(),
  windowEnd: z.date(),

  status: WrappedStatusSchema,
  /** When the timer publishes a draft nobody acted on. Null once terminal, and
   *  null while the quality floor holds a thin block back from auto-publishing. */
  autoPublishAt: z.date().nullable(),
  computedAt: z.date(),

  stats: WrappedStatsSchema,
  fullestEvent: WrappedEventHighlightSchema.nullable(),
  mostCommentedEvent: WrappedEventHighlightSchema.nullable(),
  topOrganizations: z.array(WrappedOrgCreditSchema).max(MAX_ORG_CREDITS),
  topOrganizers: z.array(WrappedPersonCreditSchema).max(MAX_PERSON_CREDITS),

  /** Download URL of each rendered card. A URL rather than a storage path
   *  because a Wrapped is made to be forwarded: the recipient may not be a
   *  member, or signed in at all, and the link has to still resolve. */
  images: z.record(WrappedCardSchema, z.string()),
});
export type WrappedData = z.infer<typeof WrappedDataSchema>;

export function wrappedId(municipalityId: string, year: number, blockId: string): string {
  return `${municipalityId}_${String(year)}_${blockId}`;
}
