import { z } from 'zod';

export const OrganizationJoinRequestStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type OrganizationJoinRequestStatus = z.infer<typeof OrganizationJoinRequestStatusSchema>;

export const OrganizationJoinRequestDataSchema = z.object({
  userId: z.string(),
  orgId: z.string(),
  municipalityId: z.string(),
  status: OrganizationJoinRequestStatusSchema,
  requestedAt: z.date(),
  reviewedAt: z.date().nullable(),
  reviewedBy: z.string().nullable(),
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
