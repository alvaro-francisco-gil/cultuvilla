export interface UserData {
  displayName: string
  email: string
  telephone: string | null
  activeMunicipalityId: string | null
  personId: string | null
  createdAt: Date
}

export interface UserDataInput {
  displayName: string
  email: string
  telephone?: string | null
  activeMunicipalityId?: string | null
  personId?: string | null
  createdAt?: Date
}

export function buildUserData(input: UserDataInput): UserData {
  return {
    displayName: input.displayName,
    email: input.email,
    telephone: input.telephone ?? null,
    activeMunicipalityId: input.activeMunicipalityId ?? null,
    personId: input.personId ?? null,
    createdAt: input.createdAt ?? new Date(),
  }
}
