import { z } from 'zod';

const emptyToNull = (v: unknown): unknown =>
  v === '' || v == null || (typeof v === 'string' && v.trim() === '') ? null : v;

const optionalDate = z.preprocess(emptyToNull, z.coerce.date().nullable());

const optionalNonNegativeNumber = z.preprocess(
  emptyToNull,
  z.coerce.number().min(0, 'Mínimo 0').nullable(),
);

const optionalPositiveInt = z.preprocess(
  emptyToNull,
  z.coerce.number().int('Debe ser un número entero').min(1, 'Mínimo 1').nullable(),
);

const optionalTrimmedString = z
  .string()
  .nullish()
  .transform((v) => {
    if (v == null) return null;
    const trimmed = v.trim();
    return trimmed === '' ? null : trimmed;
  });

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
  endDate: optionalDate,
  locationText: optionalTrimmedString,
  price: optionalNonNegativeNumber,
  maxAttendees: optionalPositiveInt,
  telephoneRequired: z.boolean().default(false),
});

export type EventFormInput = z.input<typeof EventFormSchema>;
export type EventFormValues = z.output<typeof EventFormSchema>;
