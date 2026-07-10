import { z } from 'zod';
import { EntityKindSchema } from './EntityKind';

export const CommentDataSchema = z.object({
  entityKind: EntityKindSchema,
  entityId: z.string(),
  municipalityId: z.string(),
  authorUserId: z.string(),
  body: z.string().min(1).max(2000),
  createdAt: z.date(),
});
export type CommentData = z.infer<typeof CommentDataSchema>;

export interface CommentDataInput {
  entityKind: z.infer<typeof EntityKindSchema>;
  entityId: string;
  municipalityId: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
}

export function buildCommentData(input: CommentDataInput): CommentData {
  return {
    entityKind: input.entityKind,
    entityId: input.entityId,
    municipalityId: input.municipalityId,
    authorUserId: input.authorUserId,
    body: input.body,
    createdAt: input.createdAt,
  };
}
