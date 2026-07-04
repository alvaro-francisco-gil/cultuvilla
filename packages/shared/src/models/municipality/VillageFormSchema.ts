import { z } from 'zod';

/**
 * Validation schema for the "activate village community on a municipality"
 * form. The geographic fields (name, province, comunidadAutonoma) are not
 * supplied by the form — they live on the picked municipality. The form
 * supplies the community-specific bits plus, optionally, coordinates when
 * the picked municipality doesn't already have them.
 *
 * `location` is `nullable` here so the form can be partially filled while
 * editing; the caller (`VillageForm.tsx`) decides at submit time whether a
 * non-null location is required based on the selected municipality.
 */

export const VillageLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  displayName: z.string(),
});

const trimmedRequired = (msg: string) =>
  z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, msg);

export const VillageFormSchema = z.object({
  municipalityId: z.string().min(1, 'Selecciona un municipio'),
  description: trimmedRequired('La descripción es obligatoria'),
  organizerId: z.string().min(1, 'Selecciona el coordinador'),
  location: VillageLocationSchema.nullable(),
});

export type VillageFormInput = z.input<typeof VillageFormSchema>;
export type VillageFormValues = z.output<typeof VillageFormSchema>;
