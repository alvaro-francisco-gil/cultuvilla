import { z } from 'zod';
import { MAX_SIGNUP_GROUP_SIZE } from './EventDataModel';

const emptyToNull = (v: unknown): unknown =>
  v === '' || v == null || (typeof v === 'string' && v.trim() === '') ? null : v;

const optionalPositiveInt = z.preprocess(
  emptyToNull,
  z.coerce.number().int('Debe ser un número entero').min(1, 'Mínimo 1').nullable(),
);

const optionalDate = z.preprocess(
  emptyToNull,
  z.coerce.date().nullable(),
);

/** Sanity bounds for an advertised birth-year window. */
export const MIN_EVENT_BIRTH_YEAR = 1900;
export const MAX_EVENT_BIRTH_YEAR = 2200;

const optionalBirthYear = z.preprocess(
  emptyToNull,
  z.coerce
    .number()
    .int('Debe ser un año entero')
    .min(MIN_EVENT_BIRTH_YEAR, `Mínimo ${String(MIN_EVENT_BIRTH_YEAR)}`)
    .max(MAX_EVENT_BIRTH_YEAR, `Máximo ${String(MAX_EVENT_BIRTH_YEAR)}`)
    .nullable(),
);

export const EventFormSchema = z
  .object({
    title: z
      .string()
      .transform((s) => s.trim())
      .refine((s) => s.length > 0, 'El título es obligatorio'),
    description: z
      .string()
      .default('')
      .transform((s) => s.trim()),
    startDate: z.coerce.date({ message: 'La fecha de inicio es obligatoria' }),
    // Optional multi-day end; null/empty = single-day event.
    endDate: optionalDate.default(null),
    locationName: z
      .string()
      .transform((s) => s.trim())
      .refine((s) => s.length > 0, 'El nombre del lugar es obligatorio'),
    maxAttendees: optionalPositiveInt,
    telephoneRequired: z.boolean().default(false),
    requiresPayment: z.boolean().default(false),
    // 1 = ordinary individual sign-up; 2-4 seats people together in groups.
    signupGroupSize: z.preprocess(
      (v) => (v === '' || v == null ? 1 : v),
      z.coerce
        .number()
        .int('Debe ser un número entero')
        .min(1, 'Mínimo 1')
        .max(MAX_SIGNUP_GROUP_SIZE, `Máximo ${String(MAX_SIGNUP_GROUP_SIZE)}`),
    ),
    // Off = the event takes no sign-ups through the app. `signupInfo` then
    // carries the organizer's explanation of what to do instead.
    signupEnabled: z.boolean().default(true),
    signupInfo: z.preprocess(
      (v) => emptyToNull(typeof v === 'string' ? v.trim() : v),
      z.string().max(200, 'Máximo 200 caracteres').nullable(),
    ).default(null),
    // Advisory birth-year window shown on the event and warned about at
    // sign-up. Either end may be left empty for an open-ended range.
    minBirthYear: optionalBirthYear.default(null),
    maxBirthYear: optionalBirthYear.default(null),
  })
  .refine((v) => v.endDate == null || v.endDate >= v.startDate, {
    message: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['endDate'],
  })
  // A note about signing up elsewhere is meaningless while the app still takes
  // sign-ups — reject it rather than storing a line no screen will ever show.
  .refine((v) => !v.signupEnabled || v.signupInfo == null, {
    message: 'La nota de inscripción solo aplica si las inscripciones por la app están desactivadas',
    path: ['signupInfo'],
  })
  .refine(
    (v) => v.minBirthYear == null || v.maxBirthYear == null || v.maxBirthYear >= v.minBirthYear,
    {
      message: 'El año final no puede ser anterior al inicial',
      path: ['maxBirthYear'],
    },
  )
  // A birth-year window is only ever read by the in-app sign-up sheet, so
  // storing one on an event that takes no in-app sign-ups would be a rule
  // nothing enforces and no screen explains.
  .refine((v) => v.signupEnabled || (v.minBirthYear == null && v.maxBirthYear == null), {
    message: 'El rango de años solo aplica si las inscripciones por la app están activadas',
    path: ['minBirthYear'],
  });

export type EventFormInput = z.input<typeof EventFormSchema>;
export type EventFormValues = z.output<typeof EventFormSchema>;
