import { z } from 'zod';

export const OrgRequestFormSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, 'El nombre es obligatorio'),
  type: z.enum(['ayuntamiento', 'peña', 'asociación']),
  description: z
    .string()
    .nullish()
    .transform((v) => {
      if (v == null) return null;
      const trimmed = v.trim();
      return trimmed === '' ? null : trimmed;
    }),
});

export type OrgRequestFormInput = z.input<typeof OrgRequestFormSchema>;
export type OrgRequestFormValues = z.output<typeof OrgRequestFormSchema>;
