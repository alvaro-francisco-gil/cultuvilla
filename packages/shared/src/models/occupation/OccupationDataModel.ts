export interface OccupationData {
  name: string
  createdBy: string
  createdAt: Date
}

export interface OccupationDataInput {
  name: string
  createdBy: string
}

export function buildOccupationData(input: OccupationDataInput): OccupationData {
  return { ...input, createdAt: new Date() }
}

export type OccupationProposalStatus = 'pending' | 'approved' | 'rejected'

export interface OccupationProposalData {
  name: string
  proposedBy: string
  proposedAt: Date
  status: OccupationProposalStatus
  reviewedBy: string | null
  reviewedAt: Date | null
  approvedOccupationId: string | null
}

export interface OccupationProposalDataInput {
  name: string
  proposedBy: string
}

export function buildOccupationProposalData(input: OccupationProposalDataInput): OccupationProposalData {
  return {
    name: input.name,
    proposedBy: input.proposedBy,
    proposedAt: new Date(),
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    approvedOccupationId: null,
  }
}
