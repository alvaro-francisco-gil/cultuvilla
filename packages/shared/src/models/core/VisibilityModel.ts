import { z } from 'zod';

export const VisibilityStatusSchema = z.enum(['active', 'hidden']);
export type VisibilityStatus = z.infer<typeof VisibilityStatusSchema>;

/** Spreadable visibility fields. `status` is function-owned (see firestore.rules);
    clients never write these. hidden* are null while active. */
export const visibilityFields = {
  status: VisibilityStatusSchema,
  hiddenBy: z.string().nullable(),
  hiddenAt: z.date().nullable(),
  hiddenReason: z.string().nullable(),
};

export function defaultVisibility() {
  return { status: 'active' as const, hiddenBy: null, hiddenAt: null, hiddenReason: null };
}
