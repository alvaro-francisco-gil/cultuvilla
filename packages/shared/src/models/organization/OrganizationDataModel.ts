export type OrganizationType = 'ayuntamiento' | 'peña' | 'asociación';
export type OrganizationStatus = 'pending' | 'approved' | 'rejected';

export interface OrganizationData {
  name: string;
  description: string | null;
  type: OrganizationType;
  status: OrganizationStatus;
  villageId: string;
  requestedBy: string;
  approvedBy: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}

export interface OrganizationDataInput {
  name: string;
  description?: string | null;
  type: OrganizationType;
  status?: OrganizationStatus;
  villageId: string;
  requestedBy: string;
  approvedBy?: string | null;
  createdAt?: Date;
  decidedAt?: Date | null;
}

export function buildOrganizationData(input: OrganizationDataInput): OrganizationData {
  return {
    name: input.name,
    description: input.description ?? null,
    type: input.type,
    status: input.status ?? 'pending',
    villageId: input.villageId,
    requestedBy: input.requestedBy,
    approvedBy: input.approvedBy ?? null,
    createdAt: input.createdAt ?? new Date(),
    decidedAt: input.decidedAt ?? null,
  };
}
