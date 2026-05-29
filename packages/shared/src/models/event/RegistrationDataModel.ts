// packages/shared/src/models/event/RegistrationDataModel.ts
import { z } from 'zod';

export const RegistrationStatusSchema = z.enum(['confirmed', 'waitlisted']);
export type RegistrationStatus = z.infer<typeof RegistrationStatusSchema>;

export const RegistrationDataSchema = z.object({
  userId: z.string(),
  personId: z.string(),
  name: z.string(),
  status: RegistrationStatusSchema,
  position: z.number().int(),
  registeredAt: z.date(),
  // Denormalized at write time by the `registerToEvent` Cloud Function so UIs
  // showing village-vs-visitor badges don't need a per-attendee membership
  // lookup. Optional because pre-callable registrations may lack the field;
  // treat missing as `false` and rely on a backfill to converge.
  isMember: z.boolean().optional(),
});
export type RegistrationData = z.infer<typeof RegistrationDataSchema>;

export interface RegistrationDataInput {
  userId: string;
  personId: string;
  name: string;
  status: RegistrationStatus;
  position: number;
  registeredAt?: Date;
  isMember?: boolean;
}

export function buildRegistrationData(input: RegistrationDataInput): RegistrationData {
  return { ...input, registeredAt: input.registeredAt ?? new Date() };
}
