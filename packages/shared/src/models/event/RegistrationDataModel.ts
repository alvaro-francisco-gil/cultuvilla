export type RegistrationStatus = 'confirmed' | 'waitlisted';

export interface RegistrationData {
  userId: string;
  personaId: string | null;
  name: string;
  status: RegistrationStatus;
  position: number;
  registeredAt: Date;
}

export interface RegistrationDataInput {
  userId: string;
  personaId?: string | null;
  name: string;
  status: RegistrationStatus;
  position: number;
  registeredAt?: Date;
}

export function buildRegistrationData(input: RegistrationDataInput): RegistrationData {
  return {
    userId: input.userId,
    personaId: input.personaId ?? null,
    name: input.name,
    status: input.status,
    position: input.position,
    registeredAt: input.registeredAt ?? new Date(),
  };
}
