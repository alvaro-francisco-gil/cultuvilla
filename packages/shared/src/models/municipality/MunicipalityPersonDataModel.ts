import { z } from 'zod';

export const MunicipalityPersonDataSchema = z.object({
  municipalityId: z.string(),
  personId: z.string(),
  displayName: z.string(),
  sortName: z.string(),
  photoURL: z.string().nullable(),
  // The barrio this person is linked to in THIS municipality (null = linked to
  // the village but no barrio picked). Projected so the barrio roster can read
  // this directory instead of querying persons directly — a persons query would
  // be rejected outright whenever it could match a private persona, which would
  // drop those people from the list rather than merely un-linking them.
  barrioId: z.string().nullable(),
  userId: z.string().nullable(),
  // Mirrors persons/{id}.isPublic so a roster can tell, without an extra read,
  // whether tapping a row leads anywhere. A private person stays listed here
  // by name; only their person doc is unreadable.
  isPublic: z.boolean(),
});

export type MunicipalityPersonData = z.infer<typeof MunicipalityPersonDataSchema>;

export function municipalityPersonDirectoryId(municipalityId: string, personId: string): string {
  return `${municipalityId}_${personId}`;
}
