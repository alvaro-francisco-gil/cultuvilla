import { z } from 'zod';

/**
 * The single-use secret that turns an open seat into somebody's registration.
 *
 * Stored at `events/{eventId}/seatTokens/{token}` — **the document id is the
 * secret**, so a claim is one direct lookup rather than a query, and a token
 * nobody has been given is unguessable rather than merely unlisted.
 *
 * Kept off the registration doc on purpose: registrations are world-readable
 * (`allow read: if true`), so a token stored there could be claimed by any
 * passer-by. Reads here are limited to the group owner and the event's
 * organizers; writes are callable-only.
 */
export const SeatTokenDataSchema = z.object({
  /** The open-seat registration this token fills. */
  registrationId: z.string(),
  groupId: z.string(),
  /** The group owner — who may re-read the token to re-share the link. */
  createdBy: z.string(),
  createdAt: z.date(),
  // A consumed token is kept rather than deleted: it is the audit record of
  // who took the seat. `claimEventSeat` refuses a token that already has a
  // consumedAt, so retention costs nothing in safety.
  consumedAt: z.date().nullable(),
  consumedBy: z.string().nullable(),
});
export type SeatTokenData = z.infer<typeof SeatTokenDataSchema>;

export interface SeatTokenDataInput {
  registrationId: string;
  groupId: string;
  createdBy: string;
  createdAt?: Date;
  consumedAt?: Date | null;
  consumedBy?: string | null;
}

export function buildSeatTokenData(input: SeatTokenDataInput): SeatTokenData {
  return {
    registrationId: input.registrationId,
    groupId: input.groupId,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? new Date(),
    consumedAt: input.consumedAt ?? null,
    consumedBy: input.consumedBy ?? null,
  };
}

export function isSeatTokenConsumed(token: SeatTokenData): boolean {
  return token.consumedAt !== null;
}
