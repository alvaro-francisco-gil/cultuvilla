export interface UserData {
  // ─── Denormalized from persons/{personId} — kept in sync by
  //     functions/src/users/syncPersonDenormalization.ts. The persons doc owns
  //     givenName / firstSurname / secondSurname; this field is the
  //     buildDisplayName(person) projection. Clients cannot write this
  //     directly (firestore.rules), so reads can briefly observe "" for
  //     users created before their persona exists.
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
