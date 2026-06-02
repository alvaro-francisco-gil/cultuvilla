import { z } from 'zod';
import { NewsReactionKindSchema, type NewsReactionKind } from './NewsPostDataModel';

export const NewsReactionDataSchema = z.object({
  postId: z.string(),
  municipalityId: z.string(),
  userId: z.string(),
  kind: NewsReactionKindSchema,
  createdAt: z.date(),
});
export type NewsReactionData = z.infer<typeof NewsReactionDataSchema>;

export interface NewsReactionDataInput {
  postId: string;
  municipalityId: string;
  userId: string;
  kind: NewsReactionKind;
  createdAt: Date;
}

export function reactionDocId(postId: string, userId: string): string {
  return `${postId}_${userId}`;
}

export function buildNewsReactionData(input: NewsReactionDataInput): NewsReactionData {
  return {
    postId: input.postId,
    municipalityId: input.municipalityId,
    userId: input.userId,
    kind: input.kind,
    createdAt: input.createdAt,
  };
}
