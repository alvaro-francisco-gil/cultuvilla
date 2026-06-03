import { z } from 'zod';

/**
 * App-admin grant. Stored at /admins/{userId}. Presence of the doc is what
 * isAppAdmin() in firestore.rules tests; the contents are an audit trail.
 *
 * Writes are admin-SDK-only (rules deny all client writes). Reads are
 * permitted for the owner and other admins so the client can show "you are
 * an admin" UI.
 */
export const AdminDataSchema = z.object({
  createdAt: z.date(),
});
export type AdminData = z.infer<typeof AdminDataSchema>;

export interface AdminDataInput {
  createdAt?: Date;
}

export function buildAdminData(input: AdminDataInput = {}): AdminData {
  return {
    createdAt: input.createdAt ?? new Date(),
  };
}
