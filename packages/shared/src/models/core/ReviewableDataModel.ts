import { z } from 'zod';

/**
 * The `pending → approved/rejected` lifecycle for approval-gated requests where
 * approval grants authority or creates membership, such as organizations and
 * organizer requests. Pure content uses VisibilityStatus (`active | hidden`)
 * instead.
 */
export const ReviewStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

/**
 * Spreadable Zod fields for the review decision: the status plus who decided
 * and when. `reviewedBy` / `reviewedAt` are `null` while still `pending`. The
 * entity supplies its own creator field (`requestedBy` / `userId`) and its own
 * creation timestamp — those are domain-specific and not part of this mixin.
 *
 * Usage: `z.object({ ...domainFields, ...reviewDecisionFields })`.
 */
export const reviewDecisionFields = {
  status: ReviewStatusSchema,
  reviewedBy: z.string().nullable(),
  reviewedAt: z.date().nullable(),
};
