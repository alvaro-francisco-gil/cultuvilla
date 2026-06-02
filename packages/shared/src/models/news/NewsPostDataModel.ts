import { z } from 'zod';

export const NEWS_POST_CATEGORIES = [
  'fiesta',
  'tradicion',
  'gastronomia',
  'historia',
  'otro',
] as const;
export const NewsPostCategorySchema = z.enum([...NEWS_POST_CATEGORIES]);
export type NewsPostCategory = z.infer<typeof NewsPostCategorySchema>;

export const NewsPostStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type NewsPostStatus = z.infer<typeof NewsPostStatusSchema>;

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
  authorUserId: z.string(),
  authorOrgId: z.string().nullable(),
  title: z.string(),
  body: z.string(),
  category: NewsPostCategorySchema,
  images: z.array(NewsPostImageSchema),
  status: NewsPostStatusSchema,
  rejectionReason: z.string().nullable(),
  submittedAt: z.date(),
  publishedAt: z.date().nullable(),
  createdBy: z.string(),
  updatedAt: z.date(),
  reactionCounts: NewsReactionCountsSchema,
  commentCount: z.number(),
});
export type NewsPostData = z.infer<typeof NewsPostDataSchema>;

export interface NewsPostDataInput {
  municipalityId: string;
  authorUserId: string;
  authorOrgId?: string | null;
  title: string;
  body: string;
  category: NewsPostCategory;
  images?: NewsPostImage[];
  status?: NewsPostStatus;
  rejectionReason?: string | null;
  submittedAt: Date;
  publishedAt?: Date | null;
  createdBy: string;
  updatedAt: Date;
  reactionCounts?: NewsReactionCounts;
  commentCount?: number;
}

export function buildNewsPostData(input: NewsPostDataInput): NewsPostData {
  return {
    municipalityId: input.municipalityId,
    authorUserId: input.authorUserId,
    authorOrgId: input.authorOrgId ?? null,
    title: input.title,
    body: input.body,
    category: input.category,
    images: input.images ?? [],
    status: input.status ?? 'pending',
    rejectionReason: input.rejectionReason ?? null,
    submittedAt: input.submittedAt,
    publishedAt: input.publishedAt ?? null,
    createdBy: input.createdBy,
    updatedAt: input.updatedAt,
    reactionCounts: input.reactionCounts ?? { like: 0, heart: 0 },
    commentCount: input.commentCount ?? 0,
  };
}
