import { z } from 'zod';

export const NewsCommentDataSchema = z.object({
  postId: z.string(),
  municipalityId: z.string(),
  authorUserId: z.string(),
  body: z.string(),
  createdAt: z.date(),
  hidden: z.boolean(),
});
export type NewsCommentData = z.infer<typeof NewsCommentDataSchema>;

export interface NewsCommentDataInput {
  postId: string;
  municipalityId: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
  hidden?: boolean;
}

export function buildNewsCommentData(input: NewsCommentDataInput): NewsCommentData {
  return {
    postId: input.postId,
    municipalityId: input.municipalityId,
    authorUserId: input.authorUserId,
    body: input.body,
    createdAt: input.createdAt,
    hidden: input.hidden ?? false,
  };
}
