import { z } from 'zod';

const emptyToNull = (v: unknown): unknown =>
  v === '' || v == null || (typeof v === 'string' && v.trim() === '') ? null : v;

const optionalPositiveInt = z.preprocess(
  emptyToNull,
  z.coerce.number().int('Debe ser un número entero').min(1, 'Mínimo 1').nullable(),
);

export const EventFormSchema = z.object({
  title: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, 'El título es obligatorio'),
  description: z
    .string()
    .default('')
    .transform((s) => s.trim()),
  startDate: z.coerce.date({ message: 'La fecha de inicio es obligatoria' }),
  locationName: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, 'El nombre del lugar es obligatorio'),
  maxAttendees: optionalPositiveInt,
  telephoneRequired: z.boolean().default(false),
});

export type EventFormInput = z.input<typeof EventFormSchema>;
export type EventFormValues = z.output<typeof EventFormSchema>;
