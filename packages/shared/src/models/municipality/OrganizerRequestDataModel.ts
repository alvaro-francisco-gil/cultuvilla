export type OrganizerRequestStatus = 'pending' | 'approved' | 'rejected';

export interface OrganizerRequestData {
  userId: string;
  municipalityId: string;
  requestedAt: Date;
  status: OrganizerRequestStatus;
  motivation: string | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
}

export interface OrganizerRequestDataInput {
  userId: string;
  municipalityId: string;
  motivation?: string | null;
}

export function buildOrganizerRequestData(input: OrganizerRequestDataInput): OrganizerRequestData {
  return {
    userId: input.userId,
    municipalityId: input.municipalityId,
    requestedAt: new Date(),
    status: 'pending',
    motivation: input.motivation ?? null,
    reviewedAt: null,
    reviewedBy: null,
  };
}
