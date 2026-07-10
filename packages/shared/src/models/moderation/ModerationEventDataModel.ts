import { z } from 'zod';

export const ModeratedCollectionSchema = z.enum([
  'news',
  'festivalPosters',
  'barrios',
  'places',
]);
export type ModeratedCollection = z.infer<typeof ModeratedCollectionSchema>;

export const ModerationActionSchema = z.enum(['hide', 'unhide']);
export type ModerationAction = z.infer<typeof ModerationActionSchema>;

/**
 * Append-only audit record of a content-visibility change (hide/unhide) made
 * by an admin. Stored top-level at `moderationEvents/{eventId}`, scoped by
 * `municipalityId` so a village admin can read every moderation event in
 * their village. Written ONLY by Cloud Functions (admin SDK) — clients never
 * write here (firestore.rules denies all client writes).
 */
export const ModerationEventDataSchema = z.object({
  municipalityId: z.string(),
  collection: ModeratedCollectionSchema,
  docId: z.string(),
  action: ModerationActionSchema,
  actorUserId: z.string(),
  reason: z.string().nullable(),
  createdAt: z.date(),
});
export type ModerationEventData = z.infer<typeof ModerationEventDataSchema>;

export interface ModerationEventDataInput {
  municipalityId: string;
  collection: ModeratedCollection;
  docId: string;
  action: ModerationAction;
  actorUserId: string;
  reason?: string | null;
  createdAt?: Date;
}

export function buildModerationEventData(input: ModerationEventDataInput): ModerationEventData {
  return {
    municipalityId: input.municipalityId,
    collection: input.collection,
    docId: input.docId,
    action: input.action,
    actorUserId: input.actorUserId,
    reason: input.reason ?? null,
    createdAt: input.createdAt ?? new Date(),
  };
}
