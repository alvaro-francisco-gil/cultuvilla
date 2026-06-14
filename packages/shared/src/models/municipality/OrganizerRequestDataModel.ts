import { z } from 'zod';

export const OrganizerRequestStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type OrganizerRequestStatus = z.infer<typeof OrganizerRequestStatusSchema>;

export const OrganizerRequestDataSchema = z.object({
  userId: z.string(),
  municipalityId: z.string(),
  requestedAt: z.date(),
  status: OrganizerRequestStatusSchema,
  /** Village description the requester proposes; copied to community.description on approval. */
  description: z.string(),
  /** Cover image download URLs the requester uploads; copied to community.coverImages on approval. */
  coverImages: z.array(z.string()),
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
