export type OrganizationType = 'ayuntamiento' | 'peña' | 'asociación';
export type OrganizationStatus = 'pending' | 'approved' | 'rejected';

export interface OrganizationData {
  name: string;
  description: string | null;
  type: OrganizationType;
  status: OrganizationStatus;
  requestedBy: string;
  createdAt: Date;
}

export interface OrganizationDataInput {
  name: string;
  description?: string | null;
  type: OrganizationType;
  status?: OrganizationStatus;
  requestedBy: string;
  createdAt?: Date;
}

export function buildOrganizationData(input: OrganizationDataInput): OrganizationData {
  return {
    name: input.name,
    description: input.description ?? null,
    type: input.type,
    status: input.status ?? 'pending',
    requestedBy: input.requestedBy,
    createdAt: input.createdAt ?? new Date(),
  };
}
