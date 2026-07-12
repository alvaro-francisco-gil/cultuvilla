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
  // lookup.
  isMember: z.boolean(),
  // Set by an organizer when the attendee is checked in. `null` until then.
  checkedInAt: z.date().nullable(),
  // Set by an organizer when the attendee has paid (events with
  // requiresPayment). `.default(null)`: registrations created before this field
  // existed have no paidAt key, so reads normalize the absent field to null
  // instead of throwing the strict converter.
  paidAt: z.date().nullable().default(null),
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
  checkedInAt?: Date | null;
  paidAt?: Date | null;
}

export function buildRegistrationData(input: RegistrationDataInput): RegistrationData {
  return {
    ...input,
    registeredAt: input.registeredAt ?? new Date(),
    isMember: input.isMember ?? false,
    checkedInAt: input.checkedInAt ?? null,
    paidAt: input.paidAt ?? null,
  };
}
