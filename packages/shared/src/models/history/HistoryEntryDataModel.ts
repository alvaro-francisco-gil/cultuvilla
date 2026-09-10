import { z } from 'zod';
import { visibilityFields, defaultVisibility } from '../core/VisibilityModel';
import { NewsMentionSchema, NewsLinkSchema, NewsMarkSchema } from '../news/NewsPostDataModel';

export const HISTORY_ENTRY_MAX_IMAGES = 3;
export const HISTORY_ENTRY_TITLE_MAX = 120;
export const HISTORY_ENTRY_BODY_MAX = 20000;
export const HISTORY_ENTRY_SOURCES_MAX = 2000;
export const HISTORICAL_YEAR_MIN = -9999;
export const HISTORICAL_YEAR_MAX = 9999;

/** Days in `month` of `year`, on the proleptic Gregorian calendar. `setUTCFullYear`
 *  rather than `Date.UTC(year, …)`, which maps years 0–99 onto 1900–1999. */
function daysInMonth(year: number, month: number): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month, 0);
  return d.getUTCDate();
}

/**
 * A date in a village's past, only as precise as what is actually known: a
 * year, a month of a year, or a full day. Plain integers, not a Timestamp —
 * a Timestamp cannot hold a year before 0001 (Roman and Celtiberian origins
 * are common in a pueblo's history), and it would claim a precision ("1
 * January 1500") nobody recorded. Same shape as `PartialDate`, but strict:
 * the year is required and every part is range-checked.
 */
export const HistoricalDateSchema = z
  .object({
    /** Negative is before Christ. There is no year 0. */
    year: z.number().int().min(HISTORICAL_YEAR_MIN).max(HISTORICAL_YEAR_MAX).refine((y) => y !== 0, {
      message: 'there is no year 0',
    }),
    month: z.number().int().min(1).max(12).nullable(),
    day: z.number().int().min(1).max(31).nullable(),
  })
  .refine((d) => d.day == null || d.month != null, {
    message: 'a day needs a month',
    path: ['day'],
  })
  .refine((d) => d.day == null || d.month == null || d.day <= daysInMonth(d.year, d.month), {
    message: 'day does not exist in that month',
    path: ['day'],
  });
export type HistoricalDate = z.infer<typeof HistoricalDateSchema>;

/**
 * A single sortable number for a historical date, monotonic in time for BC
 * years too. The timeline orders on it, and firestore.rules re-derives it with
 * the same arithmetic — so change both together.
 */
export function historicalDateSortKey(date: HistoricalDate): number {
  return date.year * 10000 + (date.month ?? 0) * 100 + (date.day ?? 0);
}

export const HistoryEntryImageSchema = z.object({
  url: z.string().min(1),
  /** Credit or context — old photos nearly always need one ("Archivo municipal"). */
  caption: z.string().nullable(),
});
export type HistoryEntryImage = z.infer<typeof HistoryEntryImageSchema>;

/**
 * The article body: one formatted text run with the same inline mentions, links
 * and marks as a news text block. No inline image blocks — images live in the
 * capped gallery, so the "at most 3" limit actually holds.
 */
export const HistoryEntryBodySchema = z.object({
  text: z.string().max(HISTORY_ENTRY_BODY_MAX),
  mentions: z.array(NewsMentionSchema),
  links: z.array(NewsLinkSchema),
  marks: z.array(NewsMarkSchema),
});
export type HistoryEntryBody = z.infer<typeof HistoryEntryBodySchema>;

/**
 * One event on a village's history timeline. Stored top-level at
 * `historyEntries/{entryId}`, scoped by `municipalityId`.
 */
export const HistoryEntryDataSchema = z
  .object({
    municipalityId: z.string(),
    /** The village's permanent URL slug, denormalized so a card can link without a read. */
    villageSlug: z.string(),
    createdBy: z.string(),
    title: z.string().trim().min(1).max(HISTORY_ENTRY_TITLE_MAX),
    body: HistoryEntryBodySchema,
    /** `images[0]` is the cover. */
    images: z.array(HistoryEntryImageSchema).max(HISTORY_ENTRY_MAX_IMAGES),
    start: HistoricalDateSchema,
    /** `null` for a point in time. */
    end: HistoricalDateSchema.nullable(),
    /** "Hacia 1850" — the date is an estimate. */
    approximate: z.boolean(),
    sources: z.string().max(HISTORY_ENTRY_SOURCES_MAX).nullable(),
    /** Derived from `start` (see `historicalDateSortKey`); the timeline's order. */
    sortKey: z.number().int(),
    createdAt: z.date(),
    updatedAt: z.date(),
    commentCount: z.number().int(),
    readCount: z.number().int(),
    ...visibilityFields,
  })
  .refine((d) => d.sortKey === historicalDateSortKey(d.start), {
    message: 'sortKey does not match start',
    path: ['sortKey'],
  })
  .refine((d) => d.end == null || historicalDateSortKey(d.end) > historicalDateSortKey(d.start), {
    message: 'range ends before it starts',
    path: ['end'],
  });
export type HistoryEntryData = z.infer<typeof HistoryEntryDataSchema>;

export interface HistoryEntryDataInput {
  municipalityId: string;
  villageSlug: string;
  createdBy: string;
  title: string;
  body: HistoryEntryBody;
  images?: HistoryEntryImage[];
  start: HistoricalDate;
  end?: HistoricalDate | null;
  approximate?: boolean;
  sources?: string | null;
  createdAt: Date;
  updatedAt?: Date;
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

export function buildHistoryEntryData(input: HistoryEntryDataInput): HistoryEntryData {
  return {
    municipalityId: input.municipalityId,
    villageSlug: input.villageSlug,
    createdBy: input.createdBy,
    title: input.title.trim(),
    body: input.body,
    images: input.images ?? [],
    start: input.start,
    end: input.end ?? null,
    approximate: input.approximate ?? false,
    sources: blankToNull(input.sources),
    sortKey: historicalDateSortKey(input.start),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt,
    commentCount: 0,
    readCount: 0,
    ...defaultVisibility(),
  };
}

/** The client-editable fields, with `sortKey` re-derived so an edit to the start date re-files it. */
export type HistoryEntryPatch = Pick<
  HistoryEntryData,
  'title' | 'body' | 'images' | 'start' | 'end' | 'approximate' | 'sources' | 'updatedAt'
>;

export function buildHistoryEntryPatch(
  patch: Omit<HistoryEntryPatch, 'sources'> & { sources: string | null },
): HistoryEntryPatch & { sortKey: number } {
  return {
    title: patch.title.trim(),
    body: patch.body,
    images: patch.images,
    start: patch.start,
    end: patch.end,
    approximate: patch.approximate,
    sources: blankToNull(patch.sources),
    updatedAt: patch.updatedAt,
    sortKey: historicalDateSortKey(patch.start),
  };
}
