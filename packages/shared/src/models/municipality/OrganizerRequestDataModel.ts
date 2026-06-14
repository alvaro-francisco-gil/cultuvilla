import { z } from 'zod';

export const OrganizerRequestStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type OrganizerRequestStatus = z.infer<typeof OrganizerRequestStatusSchema>;

export const OrganizerRequestDataSchema = z.object({
  userId: z.string(),
  municipalityId: z.string(),
  requestedAt: z.date(),
  status: OrganizerRequestStatusSchema,
  /** Village description the requester proposes; copied to community.description on approval.
   * `.default('')` keeps requests written before this field existed readable through
   * the strict converter (missing key → ''). */
  description: z.string().default(''),
  /** Cover image download URLs the requester uploads; copied to community.coverImages on approval.
   * `.default([])` keeps pre-field requests readable through the strict converter (missing key → []). */
  coverImages: z.array(z.string()).default([]),
  motivation: z.string().nullable(),
  reviewedAt: z.date().nullable(),
  reviewedBy: z.string().nullable(),
});
export type OrganizerRequestData = z.infer<typeof OrganizerRequestDataSchema>;

export interface OrganizerRequestDataInput {
  userId: string;
  municipalityId: string;
  description?: string;
  coverImages?: string[];
  motivation?: string | null;
}

export function buildOrganizerRequestData(input: OrganizerRequestDataInput): OrganizerRequestData {
  return {
    userId: input.userId,
    municipalityId: input.municipalityId,
    requestedAt: new Date(),
    status: 'pending',
    description: input.description ?? '',
    coverImages: input.coverImages ?? [],
    motivation: input.motivation ?? null,
    reviewedAt: null,
    reviewedBy: null,
  };
}
