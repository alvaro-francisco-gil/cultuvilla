import { z } from 'zod';

export const OrganizationTypeSchema = z.enum(['ayuntamiento', 'peña', 'asociación']);
export type OrganizationType = z.infer<typeof OrganizationTypeSchema>;

export const OrganizationStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type OrganizationStatus = z.infer<typeof OrganizationStatusSchema>;

export const OrganizationDataSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  /** Public download URL for the organization's picture. `null` when unset.
   * `.default(null)` keeps pre-imageURL docs readable through the strict
   * converter (missing key → null). */
  imageURL: z.string().nullable().default(null),
  type: OrganizationTypeSchema,
  status: OrganizationStatusSchema,
  municipalityId: z.string(),
  requestedBy: z.string(),
  approvedBy: z.string().nullable(),
  createdAt: z.date(),
  decidedAt: z.date().nullable(),
});
export type OrganizationData = z.infer<typeof OrganizationDataSchema>;

export interface OrganizationDataInput {
  name: string;
  description?: string | null;
  imageURL?: string | null;
  type: OrganizationType;
  status?: OrganizationStatus;
  municipalityId: string;
  requestedBy: string;
  approvedBy?: string | null;
  createdAt?: Date;
  decidedAt?: Date | null;
}

export function buildOrganizationData(input: OrganizationDataInput): OrganizationData {
  return {
    name: input.name,
    description: input.description ?? null,
    imageURL: input.imageURL ?? null,
    type: input.type,
    status: input.status ?? 'pending',
    municipalityId: input.municipalityId,
    requestedBy: input.requestedBy,
    approvedBy: input.approvedBy ?? null,
    createdAt: input.createdAt ?? new Date(),
    decidedAt: input.decidedAt ?? null,
  };
}
