import { z } from 'zod';

/**
 * A collected free-text occupation. Stored at /occupations/{slug}
 * (top-level, doc id = slugifyOccupation(name)) — a lightweight tally of
 * strings persons have entered, used to power suggestions/autocomplete.
 * Not moderated: any authenticated client may upsert.
 */
export const OccupationDataSchema = z.object({
  name: z.string(),
  count: z.number(),
  updatedAt: z.date(),
});
export type OccupationData = z.infer<typeof OccupationDataSchema>;
