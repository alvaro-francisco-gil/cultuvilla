import { z } from 'zod';

/**
 * One person blocked by another, stored at
 * `users/{userId}/blockedUsers/{blockedUserId}` — owned by the blocker, so the
 * doc id IS the blocked uid and the list is readable only by its owner.
 *
 * Blocking is client-side suppression, not a server-side ban: it hides the
 * blocked person's comments from the blocker's screens. App Store guideline
 * 1.2 requires this alongside reporting for any app carrying UGC.
 */
export const BlockedUserDataSchema = z.object({
  blockedUserId: z.string(),
  createdAt: z.date(),
});
export type BlockedUserData = z.infer<typeof BlockedUserDataSchema>;

export interface BlockedUserDataInput {
  blockedUserId: string;
  createdAt?: Date;
}

export function buildBlockedUserData(input: BlockedUserDataInput): BlockedUserData {
  return {
    blockedUserId: input.blockedUserId,
    createdAt: input.createdAt ?? new Date(),
  };
}
