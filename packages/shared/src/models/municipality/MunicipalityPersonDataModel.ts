import { z } from 'zod';

export const MunicipalityPersonDataSchema = z.object({
  municipalityId: z.string(),
  personId: z.string(),
  displayName: z.string(),
  sortName: z.string(),
  photoURL: z.string().nullable(),
  userId: z.string().nullable(),
});

export type MunicipalityPersonData = z.infer<typeof MunicipalityPersonDataSchema>;

export function municipalityPersonDirectoryId(municipalityId: string, personId: string): string {
  return `${municipalityId}_${personId}`;
}
