export const NEWS_POST_CATEGORIES = [
  'fiesta',
  'tradicion',
  'gastronomia',
  'historia',
  'otro',
] as const;
export type NewsPostCategory = typeof NEWS_POST_CATEGORIES[number];

export type NewsPostStatus = 'pending' | 'approved' | 'rejected';

export type NewsReactionKind = 'like' | 'heart';

export interface NewsPostImage {
  storagePath: string;
  width: number;
  height: number;
}

export interface NewsReactionCounts {
  like: number;
  heart: number;
}

/**
 * A village news post. Stored at /news/{postId} (top-level).
 */
export interface NewsPostData {
  municipalityId: string;
  authorUserId: string;
  authorOrgId: string | null;
  title: string;
  body: string;
  category: NewsPostCategory;
  images: NewsPostImage[];
  status: NewsPostStatus;
  rejectionReason: string | null;
  submittedAt: Date;
  publishedAt: Date | null;
  createdBy: string;
  updatedAt: Date;
  reactionCounts: NewsReactionCounts;
  commentCount: number;
}

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
