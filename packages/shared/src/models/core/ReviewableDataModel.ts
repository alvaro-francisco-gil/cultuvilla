import { z } from 'zod';

/**
 * The `pending → approved/rejected` lifecycle shared by every moderated or
 * approval-gated entity: organizations, barrios, places, organizer requests,
 * organization join requests, occupation proposals, and news posts. One enum
 * so the formerly-six identical copies can't drift.
 */
export const ReviewStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

/**
 * Spreadable Zod fields for the review decision: the status plus who decided
 * and when. `reviewedBy` / `reviewedAt` are `null` while still `pending`. The
 * entity supplies its own creator field (`proposedBy` / `requestedBy` /
 * `userId`) and its own creation timestamp — those are domain-specific and not
 * part of this mixin.
 *
 * Usage: `z.object({ ...domainFields, ...reviewDecisionFields })`.
 */
export const reviewDecisionFields = {
  status: ReviewStatusSchema,
  reviewedBy: z.string().nullable(),
  reviewedAt: z.date().nullable(),
};
