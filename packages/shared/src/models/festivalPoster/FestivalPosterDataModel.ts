import { z } from 'zod';
import { reviewDecisionFields, type ReviewStatus } from '../core/ReviewableDataModel';

export const DATE_PRECISIONS = ['year', 'month', 'day'] as const;
export const DatePrecisionSchema = z.enum([...DATE_PRECISIONS]);
export type DatePrecision = z.infer<typeof DatePrecisionSchema>;

/** A village fiesta poster. Stored at /festivalPosters/{posterId} (top-level). */
export const FestivalPosterDataSchema = z.object({
  municipalityId: z.string(),
  proposedBy: z.string().nullable(),
  year: z.number().int(),
  title: z.string().nullable(),
  imageURL: z.string().nullable(),
  datePrecision: DatePrecisionSchema,
  startsAt: z.date().nullable(),
  endsAt: z.date().nullable(),
  createdAt: z.date(),
  ...reviewDecisionFields,
});
export type FestivalPosterData = z.infer<typeof FestivalPosterDataSchema>;

export interface FestivalPosterDataInput {
  municipalityId: string;
  proposedBy?: string | null;
  year: number;
  title?: string | null;
  imageURL?: string | null;
  datePrecision?: DatePrecision;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdAt: Date;
  status?: ReviewStatus;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
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
    imageURL: input.imageURL ?? null,
    datePrecision,
    startsAt,
    endsAt,
    createdAt: input.createdAt,
    status: input.status ?? 'pending',
    reviewedBy: input.reviewedBy ?? null,
    reviewedAt: input.reviewedAt ?? null,
  };
}
