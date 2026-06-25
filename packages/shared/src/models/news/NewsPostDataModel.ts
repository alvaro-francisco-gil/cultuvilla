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
  category: NewsPostCategorySchema,
  images: z.array(NewsPostImageSchema),
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
  category: NewsPostCategory;
  images?: NewsPostImage[];
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
    category: input.category,
    images: input.images ?? [],
    status: input.status ?? 'pending',
    rejectionReason: input.rejectionReason ?? null,
    submittedAt: input.submittedAt,
    publishedAt: input.publishedAt ?? null,
    updatedAt: input.updatedAt,
    reactionCounts: input.reactionCounts ?? { like: 0, heart: 0 },
    commentCount: input.commentCount ?? 0,
  };
}
