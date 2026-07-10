import { z } from 'zod';
import { EntityKindSchema, type EntityKind } from './EntityKind';

export const ReactionKindSchema = z.enum(['like', 'heart']);
export type ReactionKind = z.infer<typeof ReactionKindSchema>;

/** Denormalized per-kind counters kept on each entity doc. */
export const ReactionCountsSchema = z.object({
  like: z.number().int().nonnegative(),
  heart: z.number().int().nonnegative(),
});
export type ReactionCounts = z.infer<typeof ReactionCountsSchema>;

export const ReactionDataSchema = z.object({
  entityKind: EntityKindSchema,
  entityId: z.string(),
  municipalityId: z.string(),
  userId: z.string(),
  kind: ReactionKindSchema,
  createdAt: z.date(),
});
export type ReactionData = z.infer<typeof ReactionDataSchema>;

export interface ReactionDataInput {
  entityKind: EntityKind;
  entityId: string;
  municipalityId: string;
  userId: string;
  kind: ReactionKind;
  createdAt: Date;
}

export function reactionDocId(entityKind: EntityKind, entityId: string, userId: string): string {
  return `${entityKind}_${entityId}_${userId}`;
}

export function buildReactionData(input: ReactionDataInput): ReactionData {
  return {
    entityKind: input.entityKind,
    entityId: input.entityId,
    municipalityId: input.municipalityId,
    userId: input.userId,
    kind: input.kind,
    createdAt: input.createdAt,
  };
}
