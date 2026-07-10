import { z } from 'zod';
import { visibilityFields, defaultVisibility } from '../core/VisibilityModel';
import { ReactionCountsSchema } from '../interaction/ReactionDataModel';

export const DATE_PRECISIONS = ['year', 'month', 'day'] as const;
export const DatePrecisionSchema = z.enum([...DATE_PRECISIONS]);
export type DatePrecision = z.infer<typeof DatePrecisionSchema>;

/** A village fiesta poster. Stored at /festivalPosters/{posterId} (top-level). */
export const FestivalPosterDataSchema = z.object({
  municipalityId: z.string(),
  proposedBy: z.string().nullable(),
  year: z.number().int(),
  title: z.string().nullable(),
  images: z.array(z.string()).max(5),
  datePrecision: DatePrecisionSchema,
  startsAt: z.date().nullable(),
  endsAt: z.date().nullable(),
  createdAt: z.date(),
  // Denormalized interaction counters, maintained server-side by the comments /
  // reactions Cloud Function triggers. Initialized to 0 at create.
  commentCount: z.number().int(),
  reactionCounts: ReactionCountsSchema,
  ...visibilityFields,
});
export type FestivalPosterData = z.infer<typeof FestivalPosterDataSchema>;

export interface FestivalPosterDataInput {
  municipalityId: string;
  proposedBy?: string | null;
  year: number;
  title?: string | null;
  images?: string[];
  datePrecision?: DatePrecision;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdAt: Date;
}

export function buildFestivalPosterData(input: FestivalPosterDataInput): FestivalPosterData {
  const datePrecision = input.datePrecision ?? 'year';
  // 'year' precision carries no dates; precise precisions must have a start.
  const startsAt = datePrecision === 'year' ? null : (input.startsAt ?? null);
  const endsAt = datePrecision === 'year' ? null : (input.endsAt ?? null);
  if (datePrecision !== 'year' && !startsAt) {
    throw new Error(`buildFestivalPosterData: datePrecision '${datePrecision}' requires startsAt`);
  }
  return {
    municipalityId: input.municipalityId,
    proposedBy: input.proposedBy ?? null,
    year: input.year,
    title: input.title ?? null,
    images: input.images ?? [],
    datePrecision,
    startsAt,
    endsAt,
    createdAt: input.createdAt,
    commentCount: 0,
    reactionCounts: { like: 0, heart: 0 },
    ...defaultVisibility(),
  };
}
