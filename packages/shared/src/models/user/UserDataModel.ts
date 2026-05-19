export interface UserData {
  displayName: string
  email: string
  birthday: Date
  biography: string | null
  telephone: string | null
  photoURL: string | null
  activeMunicipalityId: string | null
  personId: string | null
  createdAt: Date
}

export interface UserDataInput {
  displayName: string
  email: string
  birthday: Date
  biography?: string | null
  telephone?: string | null
  photoURL?: string | null
  activeMunicipalityId?: string | null
  personId?: string | null
  createdAt?: Date
}

export function buildUserData(input: UserDataInput): UserData {
  return {
    displayName: input.displayName,
    email: input.email,
    birthday: input.birthday,
    biography: input.biography ?? null,
    telephone: input.telephone ?? null,
    photoURL: input.photoURL ?? null,
    activeMunicipalityId: input.activeMunicipalityId ?? null,
    personId: input.personId ?? null,
    createdAt: input.createdAt ?? new Date(),
  }
}
