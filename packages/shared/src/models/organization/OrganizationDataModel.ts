import { z } from 'zod';

export const OrganizationTypeSchema = z.enum(['ayuntamiento', 'peña', 'asociación', 'otros']);
export type OrganizationType = z.infer<typeof OrganizationTypeSchema>;

/**
 * Organization types a client may propose, in display order. `ayuntamiento`
 * is a singleton created via the requestAyuntamiento callable (handled
 * elsewhere), so it is excluded from the inline propose form.
 */
export const PROPOSABLE_ORGANIZATION_TYPES: readonly OrganizationType[] = [
  'peña',
  'asociación',
  'otros',
] as const;

export const OrganizationStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type OrganizationStatus = z.infer<typeof OrganizationStatusSchema>;

export const OrganizationDataSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  /** Public download URL for the organization's picture. `null` when unset. */
  imageURL: z.string().nullable(),
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
  /** Optional caller-minted doc id (see newOrganizationId) — lets an image be
   * uploaded to the org's storage path before the doc is created. */
  id?: string;
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
