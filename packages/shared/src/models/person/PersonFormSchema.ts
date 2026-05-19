import { z } from 'zod';
import type { PartialDate } from './PersonDataModel';

const nullableTrimmed = z
  .string()
  .nullish()
  .transform((v) => {
    if (v == null) return null;
    const trimmed = v.trim();
    return trimmed === '' ? null : trimmed;
  });

const emptyToNull = (v: unknown): unknown =>
  v === '' || v == null || (typeof v === 'string' && v.trim() === '') ? null : v;

const optionalYear = z.preprocess(
  emptyToNull,
  z.coerce.number().int('Debe ser un año entero').nullable(),
);

const intInRange = (min: number, max: number, message: string) =>
  z.preprocess(
    emptyToNull,
    z.coerce
      .number()
      .int('Debe ser un número entero')
      .min(min, message)
      .max(max, message)
      .nullable(),
  );

export const PersonFormSchema = z.object({
  givenName: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, 'El nombre es obligatorio'),
  middleNames: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
    ),
  firstSurname: nullableTrimmed,
  secondSurname: nullableTrimmed,
  nickname: nullableTrimmed,
  sex: z
    .union([z.enum(['male', 'female', 'other']), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullish()
    .transform((v) => v ?? null),
  birthYear: optionalYear,
  birthMonth: intInRange(1, 12, 'Mes inválido'),
  birthDay: intInRange(1, 31, 'Día inválido'),
  deathYear: optionalYear,
  deathMonth: intInRange(1, 12, 'Mes inválido'),
  deathDay: intInRange(1, 31, 'Día inválido'),
  biography: nullableTrimmed,
});

export type PersonFormInput = z.input<typeof PersonFormSchema>;
export type PersonFormValues = z.output<typeof PersonFormSchema>;

export function assemblePartialDate(
  year: number | null,
  month: number | null,
  day: number | null,
): PartialDate | null {
  if (year === null && month === null && day === null) return null;
  return { year, month, day };
}
