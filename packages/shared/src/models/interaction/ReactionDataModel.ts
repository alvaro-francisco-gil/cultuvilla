import { z } from 'zod';
import { EntityKindSchema, type EntityKind } from './EntityKind';

export const ReactionKindSchema = z.enum(['like', 'heart']);
export type ReactionKind = z.infer<typeof ReactionKindSchema>;

/**
 * Denormalized per-kind counters kept on each entity doc. Kept deliberately
 * loose (`z.number()`, not `.int().nonnegative()`) because this schema backs
 * the strict READ converter for five entity types: the count trigger uses
 * unclamped `FieldValue.increment`, so transient counter drift (e.g. a
 * delete-before-create trigger race) must NOT make `fromFirestore` throw and
 * crash the whole feed page. Clamping belongs in the UI (ReactionBar does
 * `Math.max(0, …)`), not in the read schema. Mirrors NewsReactionCountsSchema.
 */
export const ReactionCountsSchema = z.object({
  like: z.number(),
  heart: z.number(),
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
