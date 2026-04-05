export const MAX_PERSONAS_PER_USER = 50;

export interface PersonaData {
  name: string;
  birthday: Date;
  biography: string | null;
  photoURL: string | null;
  createdAt: Date;
}

export interface PersonaDataInput {
  name: string;
  birthday: Date;
  biography?: string | null;
  photoURL?: string | null;
  createdAt?: Date;
}

export function buildPersonaData(input: PersonaDataInput): PersonaData {
  return {
    name: input.name,
    birthday: input.birthday,
    biography: input.biography ?? null,
    photoURL: input.photoURL ?? null,
    createdAt: input.createdAt ?? new Date(),
  };
}
