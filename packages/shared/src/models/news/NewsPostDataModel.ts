import { z } from 'zod';
import { ReviewStatusSchema, type ReviewStatus } from '../core/ReviewableDataModel';

export const NEWS_POST_CATEGORIES = [
  'fiesta',
  'tradicion',
  'gastronomia',
  'historia',
  'otro',
] as const;
export const NewsPostCategorySchema = z.enum([...NEWS_POST_CATEGORIES]);
export type NewsPostCategory = z.infer<typeof NewsPostCategorySchema>;

export const NewsPostStatusSchema = ReviewStatusSchema;
export type NewsPostStatus = ReviewStatus;

export const NewsReactionKindSchema = z.enum(['like', 'heart']);
export type NewsReactionKind = z.infer<typeof NewsReactionKindSchema>;

export const NewsPostImageSchema = z.object({
  storagePath: z.string(),
  width: z.number(),
  height: z.number(),
});
export type NewsPostImage = z.infer<typeof NewsPostImageSchema>;

// ── Rich body: block content + inline mentions ────────────────────────────
// The prose is an ordered list of blocks (paragraphs + inline images), a la a
// mobile block editor. `body` (above) is kept as a flattened plain-text mirror
// of the text blocks for legacy readers, search, and previews.

/** Entities an `@`-mention can point at. Places already exist as a collection. */
export const MENTION_ENTITY_TYPES = ['organization', 'user', 'event', 'place'] as const;
export const MentionEntityTypeSchema = z.enum([...MENTION_ENTITY_TYPES]);
export type MentionEntityType = z.infer<typeof MentionEntityTypeSchema>;

/**
 * A mention span within a text block. `offset`/`length` locate it in the block's
 * `text`; `label` is a snapshot of the entity's display name at insert time so
 * the post renders even if the target is later renamed or deleted.
 */
export const NewsMentionSchema = z.object({
  entityType: MentionEntityTypeSchema,
  entityId: z.string(),
  label: z.string(),
  offset: z.number(),
  length: z.number(),
});
export type NewsMention = z.infer<typeof NewsMentionSchema>;

export const NewsTextBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  mentions: z.array(NewsMentionSchema),
});
export type NewsTextBlock = z.infer<typeof NewsTextBlockSchema>;

export const NewsImageBlockSchema = z.object({
  type: z.literal('image'),
  storagePath: z.string(),
  width: z.number(),
  height: z.number(),
  caption: z.string().nullable(),
});
export type NewsImageBlock = z.infer<typeof NewsImageBlockSchema>;

export const NewsBlockSchema = z.discriminatedUnion('type', [
  NewsTextBlockSchema,
  NewsImageBlockSchema,
]);
export type NewsBlock = z.infer<typeof NewsBlockSchema>;

export const NewsReactionCountsSchema = z.object({
  like: z.number(),
  heart: z.number(),
});
export type NewsReactionCounts = z.infer<typeof NewsReactionCountsSchema>;

/**
 * A village news post. Stored at /news/{postId} (top-level).
 */
export const NewsPostDataSchema = z.object({
  municipalityId: z.string(),
  createdBy: z.string(),
  organizerUserIds: z.array(z.string()),
  organizerOrgIds: z.array(z.string()),
  title: z.string(),
  body: z.string(),
  // Rich block content. `.default([])` keeps legacy docs (written before this
  // field existed) parseable on read — the converter runs schema.parse() on
  // every read and would otherwise throw on the missing key.
  content: z.array(NewsBlockSchema).default([]),
  category: NewsPostCategorySchema,
  images: z.array(NewsPostImageSchema),
  /** Dedicated card cover. Supersedes images[0] for the feed. `.default(null)`
      for legacy-doc back-compat (see `content`). */
  coverImage: NewsPostImageSchema.nullable().default(null),
  status: NewsPostStatusSchema,
  rejectionReason: z.string().nullable(),
  submittedAt: z.date(),
  publishedAt: z.date().nullable(),
  updatedAt: z.date(),
  reactionCounts: NewsReactionCountsSchema,
  commentCount: z.number(),
});
export type NewsPostData = z.infer<typeof NewsPostDataSchema>;

export interface NewsPostDataInput {
  municipalityId: string;
  createdBy: string;
  organizerUserIds: string[];
  organizerOrgIds?: string[];
  title: string;
  body: string;
  content?: NewsBlock[];
  category: NewsPostCategory;
  images?: NewsPostImage[];
  coverImage?: NewsPostImage | null;
  status?: NewsPostStatus;
  rejectionReason?: string | null;
  submittedAt: Date;
  publishedAt?: Date | null;
  updatedAt: Date;
  reactionCounts?: NewsReactionCounts;
  commentCount?: number;
}

export function buildNewsPostData(input: NewsPostDataInput): NewsPostData {
  return {
    municipalityId: input.municipalityId,
    createdBy: input.createdBy,
    organizerUserIds: input.organizerUserIds,
    organizerOrgIds: input.organizerOrgIds ?? [],
    title: input.title,
    body: input.body,
    content: input.content ?? [],
    category: input.category,
    images: input.images ?? [],
    coverImage: input.coverImage ?? null,
    status: input.status ?? 'pending',
    rejectionReason: input.rejectionReason ?? null,
    submittedAt: input.submittedAt,
    publishedAt: input.publishedAt ?? null,
    updatedAt: input.updatedAt,
    reactionCounts: input.reactionCounts ?? { like: 0, heart: 0 },
    commentCount: input.commentCount ?? 0,
  };
}
