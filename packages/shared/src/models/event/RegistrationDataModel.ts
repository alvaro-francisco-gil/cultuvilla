// packages/shared/src/models/event/RegistrationDataModel.ts
export type RegistrationStatus = 'confirmed' | 'waitlisted'

export interface RegistrationData {
  userId: string        // who owns this registration (for permissions/queries)
  personId: string      // the person being registered — always required
  name: string          // denormalized display name
  status: RegistrationStatus
  position: number
  registeredAt: Date
  // Denormalized at write time by the `registerToEvent` Cloud Function so UIs
  // showing village-vs-visitor badges don't need a per-attendee membership
  // lookup. Optional because pre-callable registrations may lack the field;
  // treat missing as `false` and rely on a backfill to converge.
  isMember?: boolean
}

export interface RegistrationDataInput {
  userId: string
  personId: string
  name: string
  status: RegistrationStatus
  position: number
  registeredAt?: Date
  isMember?: boolean
}

export function buildRegistrationData(input: RegistrationDataInput): RegistrationData {
  return { ...input, registeredAt: input.registeredAt ?? new Date() }
}
