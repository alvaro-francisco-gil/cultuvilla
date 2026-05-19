export type Sex = 'male' | 'female' | 'other'

export interface PartialDate {
  year: number | null
  month: number | null  // 1–12
  day: number | null    // 1–31
}

export interface MunicipalityLink {
  municipalityId: string
  barrioId: string | null
}

export interface BurialPlace {
  municipalityId: string
  cemeteryId: string
}

export interface PersonData {
  // Name
  givenName: string
  middleNames: string[]
  firstSurname: string | null
  secondSurname: string | null
  nickname: string | null
  sex: Sex | null

  // Dates
  birthday: PartialDate | null
  deathDate: PartialDate | null

  // Places
  birthPlace: MunicipalityLink | null
  burialPlace: BurialPlace | null
  municipalityLinks: MunicipalityLink[]

  // Work — multi-select
  occupationIds: string[]        // approved occupation IDs
  pendingOccupations: string[]   // free text while proposals are pending

  // Bio
  biography: string | null
  photoURL: string | null

  // Auth link
  userId: string | null          // Firebase Auth uid if this person has an account

  // Meta
  createdBy: string
  createdAt: Date
}

export interface PersonDataInput {
  givenName: string
  middleNames?: string[]
  firstSurname?: string | null
  secondSurname?: string | null
  nickname?: string | null
  sex?: Sex | null
  birthday?: PartialDate | null
  deathDate?: PartialDate | null
  birthPlace?: MunicipalityLink | null
  burialPlace?: BurialPlace | null
  municipalityLinks?: MunicipalityLink[]
  occupationIds?: string[]
  pendingOccupations?: string[]
  biography?: string | null
  photoURL?: string | null
  userId?: string | null
  createdBy: string
}

export function buildPersonData(input: PersonDataInput): PersonData {
  return {
    givenName: input.givenName,
    middleNames: input.middleNames ?? [],
    firstSurname: input.firstSurname ?? null,
    secondSurname: input.secondSurname ?? null,
    nickname: input.nickname ?? null,
    sex: input.sex ?? null,
    birthday: input.birthday ?? null,
    deathDate: input.deathDate ?? null,
    birthPlace: input.birthPlace ?? null,
    burialPlace: input.burialPlace ?? null,
    municipalityLinks: input.municipalityLinks ?? [],
    occupationIds: input.occupationIds ?? [],
    pendingOccupations: input.pendingOccupations ?? [],
    biography: input.biography ?? null,
    photoURL: input.photoURL ?? null,
    userId: input.userId ?? null,
    createdBy: input.createdBy,
    createdAt: new Date(),
  }
}

/** Full display name: "Juan Carlos García López" */
export function buildDisplayName(
  person: Pick<PersonData, 'givenName' | 'middleNames' | 'firstSurname' | 'secondSurname'>
): string {
  return [person.givenName, ...person.middleNames, person.firstSurname, person.secondSurname]
    .filter(Boolean)
    .join(' ')
}

/** Short name for tight spaces: nickname if set, otherwise "Juan García" */
export function buildShortName(
  person: Pick<PersonData, 'givenName' | 'nickname' | 'firstSurname'>
): string {
  return person.nickname ?? [person.givenName, person.firstSurname].filter(Boolean).join(' ')
}
