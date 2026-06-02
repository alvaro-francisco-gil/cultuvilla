import { z } from 'zod';

export const JoinRequestStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type JoinRequestStatus = z.infer<typeof JoinRequestStatusSchema>;

export const JoinRequestDataSchema = z.object({
  userId: z.string(),
  requestedAt: z.date(),
  status: JoinRequestStatusSchema,
  message: z.string().nullable(),
  reviewedAt: z.date().nullable(),
  reviewedBy: z.string().nullable(),
});
export type JoinRequestData = z.infer<typeof JoinRequestDataSchema>;

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
