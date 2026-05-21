export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface JoinRequestData {
  userId: string;
  requestedAt: Date;
  status: JoinRequestStatus;
  message: string | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
}

export interface JoinRequestDataInput {
  userId: string;
  message?: string | null;
}

export function buildJoinRequestData(input: JoinRequestDataInput): JoinRequestData {
  return {
    userId: input.userId,
    requestedAt: new Date(),
    status: 'pending',
    message: input.message ?? null,
    reviewedAt: null,
    reviewedBy: null,
  };
}
