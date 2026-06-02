import { z } from 'zod';

/**
 * An invite token grants entry to a municipality's community.
 * Stored at /municipalities/{municipalityId}/inviteTokens/{tokenId}.
 */
export const InviteTokenDataSchema = z.object({
  createdAt: z.date(),
  expiresAt: z.date().nullable(),
  usageCount: z.number().int(),
});
export type InviteTokenData = z.infer<typeof InviteTokenDataSchema>;

export interface InviteTokenDataInput {
  createdAt?: Date;
  expiresAt?: Date | null;
  usageCount?: number;
}

export function buildInviteTokenData(input: InviteTokenDataInput = {}): InviteTokenData {
  return {
    createdAt: input.createdAt ?? new Date(),
    expiresAt: input.expiresAt ?? null,
    usageCount: input.usageCount ?? 0,
  };
}

export function isTokenExpired(token: InviteTokenData): boolean {
  if (!token.expiresAt) return false;
  return new Date() > token.expiresAt;
}
