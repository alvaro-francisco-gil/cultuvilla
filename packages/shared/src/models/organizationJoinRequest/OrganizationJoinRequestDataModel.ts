import { z } from 'zod';
import {
  ReviewStatusSchema,
  reviewDecisionFields,
  type ReviewStatus,
} from '../core/ReviewableDataModel';

export const OrganizationJoinRequestStatusSchema = ReviewStatusSchema;
export type OrganizationJoinRequestStatus = ReviewStatus;

export const OrganizationJoinRequestDataSchema = z.object({
  userId: z.string(),
  orgId: z.string(),
  municipalityId: z.string(),
  requestedAt: z.date(),
  // status + reviewedBy + reviewedAt
  ...reviewDecisionFields,
});
export type OrganizationJoinRequestData = z.infer<typeof OrganizationJoinRequestDataSchema>;

export interface OrganizationJoinRequestDataInput {
  userId: string;
  orgId: string;
  municipalityId: string;
}

export function buildOrganizationJoinRequestData(
  input: OrganizationJoinRequestDataInput,
): OrganizationJoinRequestData {
  return {
    userId: input.userId,
    orgId: input.orgId,
    municipalityId: input.municipalityId,
    status: 'pending',
    requestedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
  };
}
