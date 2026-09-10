import { z } from 'zod';
import { visibilityFields, defaultVisibility } from '../core/VisibilityModel';
import { contributorFields } from '../core/ContributorsModel';

export const DATE_PRECISIONS = ['year', 'month', 'day'] as const;
export const DatePrecisionSchema = z.enum([...DATE_PRECISIONS]);
export type DatePrecision = z.infer<typeof DatePrecisionSchema>;

/** A village fiesta poster. Stored at /festivalPosters/{posterId} (top-level). */
export const FestivalPosterDataSchema = z.object({
  municipalityId: z.string(),
  /** The village's permanent URL slug, denormalized so a card can link without a read. */
  villageSlug: z.string(),
  proposedBy: z.string().nullable(),
  ...contributorFields,
  year: z.number().int(),
  title: z.string().nullable(),
  images: z.array(z.string()).max(5),
  datePrecision: DatePrecisionSchema,
  startsAt: z.date().nullable(),
  endsAt: z.date().nullable(),
  createdAt: z.date(),
  // Denormalized interaction counters, maintained server-side by the comments
  // Cloud Function trigger / the detail-screen view tracker. Initialized to 0
  // at create.
  commentCount: z.number().int(),
  readCount: z.number().int(),
  ...visibilityFields,
});
export type FestivalPosterData = z.infer<typeof FestivalPosterDataSchema>;

export interface FestivalPosterDataInput {
  municipalityId: string;
  villageSlug: string;
  proposedBy?: string | null;
  contributorUserIds?: string[];
  contributorOrgIds?: string[];
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
    villageSlug: input.villageSlug,
    proposedBy: input.proposedBy ?? null,
    contributorUserIds: input.contributorUserIds ?? [],
    contributorOrgIds: input.contributorOrgIds ?? [],
    year: input.year,
    title: input.title ?? null,
    images: input.images ?? [],
    datePrecision,
    startsAt,
    endsAt,
    createdAt: input.createdAt,
    commentCount: 0,
    readCount: 0,
    ...defaultVisibility(),
  };
}
