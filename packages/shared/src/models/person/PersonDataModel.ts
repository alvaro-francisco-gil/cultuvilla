import { z } from 'zod';

export const SexSchema = z.enum(['male', 'female', 'other']);
export type Sex = z.infer<typeof SexSchema>;

export const PartialDateSchema = z.object({
  year: z.number().int().nullable(),
  month: z.number().int().nullable(), // 1–12 (not enforced; matches legacy shape)
  day: z.number().int().nullable(),   // 1–31 (not enforced; matches legacy shape)
});
export type PartialDate = z.infer<typeof PartialDateSchema>;

export const MunicipalityLinkSchema = z.object({
  municipalityId: z.string(),
  barrioId: z.string().nullable(),
});
export type MunicipalityLink = z.infer<typeof MunicipalityLinkSchema>;

export const BurialPlaceSchema = z.object({
  municipalityId: z.string(),
  cemeteryId: z.string(),
});
export type BurialPlace = z.infer<typeof BurialPlaceSchema>;

export const PersonDataSchema = z.object({
  // Name
  givenName: z.string(),
  middleNames: z.array(z.string()),
  firstSurname: z.string().nullable(),
  secondSurname: z.string().nullable(),
  nickname: z.string().nullable(),
  sex: SexSchema.nullable(),

  // Dates
  birthday: PartialDateSchema.nullable(),
  deathDate: PartialDateSchema.nullable(),

  // Places
  birthPlace: MunicipalityLinkSchema.nullable(),
  burialPlace: BurialPlaceSchema.nullable(),
  municipalityLinks: z.array(MunicipalityLinkSchema),

  // Work — multi-select
  occupationIds: z.array(z.string()),       // approved occupation IDs
  pendingOccupations: z.array(z.string()),  // free text while proposals are pending

  // Bio
  biography: z.string().nullable(),
  photoURL: z.string().nullable(),

  // Auth link
  userId: z.string().nullable(),            // Firebase Auth uid if this person has an account

  // Meta
  createdBy: z.string(),
  createdAt: z.date(),
});
export type PersonData = z.infer<typeof PersonDataSchema>;

export interface PersonDataInput {
  givenName: string;
  middleNames?: string[];
  firstSurname?: string | null;
  secondSurname?: string | null;
  nickname?: string | null;
  sex?: Sex | null;
  birthday?: PartialDate | null;
  deathDate?: PartialDate | null;
  birthPlace?: MunicipalityLink | null;
  burialPlace?: BurialPlace | null;
  municipalityLinks?: MunicipalityLink[];
  occupationIds?: string[];
  pendingOccupations?: string[];
  biography?: string | null;
  photoURL?: string | null;
  userId?: string | null;
  createdBy: string;
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
  };
}

/** Full display name: "Juan Carlos García López" */
export function buildDisplayName(
  person: Pick<PersonData, 'givenName' | 'middleNames' | 'firstSurname' | 'secondSurname'>,
): string {
  return [person.givenName, ...person.middleNames, person.firstSurname, person.secondSurname]
    .filter(Boolean)
    .join(' ');
}

/** Short name for tight spaces: nickname if set, otherwise "Juan García" */
export function buildShortName(
  person: Pick<PersonData, 'givenName' | 'nickname' | 'firstSurname'>,
): string {
  return person.nickname ?? [person.givenName, person.firstSurname].filter(Boolean).join(' ');
}
