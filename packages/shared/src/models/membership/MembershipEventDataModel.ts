import { z } from 'zod';

export const MembershipScopeTypeSchema = z.enum(['village', 'org']);
export type MembershipScopeType = z.infer<typeof MembershipScopeTypeSchema>;

export const MembershipActionSchema = z.enum([
  'added',
  'removed',
  'role_changed',
  'organizer_set',
]);
export type MembershipAction = z.infer<typeof MembershipActionSchema>;

/**
 * Append-only audit record of a membership/role change in a village or org.
 * Stored top-level at `membershipEvents/{eventId}`, scoped by `municipalityId`
 * so a village admin can read every membership event in their village —
 * including changes inside its orgs. Written ONLY by Cloud Functions (admin
 * SDK); clients never write here (firestore.rules denies all client writes,
 * which is why there is no client-write shape predicate for this collection).
 *
 * `fromRole`/`toRole` are plain strings, not a role enum, because village
 * ('user' | 'admin') and org ('member' | 'admin') roles share this one log.
 */
export const MembershipEventDataSchema = z.object({
  scopeType: MembershipScopeTypeSchema,
  // The group the change happened in: municipalityId (village) | orgId (org).
  scopeId: z.string(),
  // Always the village municipality: == scopeId for villages; the org's
  // municipalityId for orgs. This is the field reads + rules scope on.
  municipalityId: z.string(),
  // Who performed the change (admin uid, or the approving super-admin).
  actorUserId: z.string(),
  // Whose membership changed.
  targetUserId: z.string(),
  action: MembershipActionSchema,
  fromRole: z.string().nullable(),
  toRole: z.string().nullable(),
  at: z.date(),
});
export type MembershipEventData = z.infer<typeof MembershipEventDataSchema>;

export interface MembershipEventDataInput {
  scopeType: MembershipScopeType;
  scopeId: string;
  municipalityId: string;
  actorUserId: string;
  targetUserId: string;
  action: MembershipAction;
  fromRole?: string | null;
  toRole?: string | null;
  at?: Date;
}

export function buildMembershipEventData(input: MembershipEventDataInput): MembershipEventData {
  return {
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    municipalityId: input.municipalityId,
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    action: input.action,
    fromRole: input.fromRole ?? null,
    toRole: input.toRole ?? null,
    at: input.at ?? new Date(),
  };
}
