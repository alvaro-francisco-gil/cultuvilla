import { z } from 'zod';

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

export const OccupationProposalStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type OccupationProposalStatus = z.infer<typeof OccupationProposalStatusSchema>;

/**
 * A user-submitted occupation proposal awaiting moderator review.
 * Stored at /occupationProposals/{proposalId} (top-level).
 */
export const OccupationProposalDataSchema = z.object({
  name: z.string(),
  proposedBy: z.string(),
  proposedAt: z.date(),
  status: OccupationProposalStatusSchema,
  reviewedBy: z.string().nullable(),
  reviewedAt: z.date().nullable(),
  approvedOccupationId: z.string().nullable(),
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
