import { z } from 'zod';
import {
  ReviewStatusSchema,
  reviewDecisionFields,
  type ReviewStatus,
} from '../core/ReviewableDataModel';

/**
 * A canonical occupation. Stored at /occupations/{occupationId} (top-level).
 */
export const OccupationDataSchema = z.object({
  name: z.string(),
  createdBy: z.string(),
  createdAt: z.date(),
});
export type OccupationData = z.infer<typeof OccupationDataSchema>;

export interface OccupationDataInput {
  name: string;
  createdBy: string;
}

export function buildOccupationData(input: OccupationDataInput): OccupationData {
  return { ...input, createdAt: new Date() };
}

export const OccupationProposalStatusSchema = ReviewStatusSchema;
export type OccupationProposalStatus = ReviewStatus;

/**
 * A user-submitted occupation proposal awaiting moderator review.
 * Stored at /occupationProposals/{proposalId} (top-level).
 */
export const OccupationProposalDataSchema = z.object({
  name: z.string(),
  proposedBy: z.string(),
  proposedAt: z.date(),
  approvedOccupationId: z.string().nullable(),
  // status + reviewedBy + reviewedAt
  ...reviewDecisionFields,
});
export type OccupationProposalData = z.infer<typeof OccupationProposalDataSchema>;

export interface OccupationProposalDataInput {
  name: string;
  proposedBy: string;
}

export function buildOccupationProposalData(
  input: OccupationProposalDataInput,
): OccupationProposalData {
  return {
    name: input.name,
    proposedBy: input.proposedBy,
    proposedAt: new Date(),
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    approvedOccupationId: null,
  };
}
