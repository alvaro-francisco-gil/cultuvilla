import { z } from 'zod';
import {
  ReviewStatusSchema,
  reviewDecisionFields,
  type ReviewStatus,
} from '../core/ReviewableDataModel';

export const OrganizerRequestStatusSchema = ReviewStatusSchema;
export type OrganizerRequestStatus = ReviewStatus;

export const OrganizerRequestDataSchema = z.object({
  userId: z.string(),
  municipalityId: z.string(),
  requestedAt: z.date(),
  /** Village description the requester proposes; copied to community.description on approval. */
  description: z.string(),
  motivation: z.string().nullable(),
  // status + reviewedBy + reviewedAt
  ...reviewDecisionFields,
});
export type OrganizerRequestData = z.infer<typeof OrganizerRequestDataSchema>;

export interface OrganizerRequestDataInput {
  userId: string;
  municipalityId: string;
  description?: string;
  motivation?: string | null;
}

export function buildOrganizerRequestData(input: OrganizerRequestDataInput): OrganizerRequestData {
  return {
    userId: input.userId,
    municipalityId: input.municipalityId,
    requestedAt: new Date(),
    status: 'pending',
    description: input.description ?? '',
    motivation: input.motivation ?? null,
    reviewedAt: null,
    reviewedBy: null,
  };
}
