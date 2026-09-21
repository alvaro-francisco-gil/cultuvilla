import { z } from 'zod';

/**
 * The business registry, shaped for the founders' panel.
 *
 * Generated from `project/**` by `scripts/generate-business-snapshot.mjs` and
 * served by the `getBusinessSnapshot` callable — it is never stored in Firestore
 * and never shipped in a client bundle. The schema lives here because it crosses
 * a workspace boundary (the generator writes it, `functions/` serves it,
 * `apps/panel/` reads it) and it is parsed at both ends: at generation, so a
 * broken generator fails the build, and in the panel, so a shape change cannot
 * render as silently missing sections.
 */

export const BUSINESS_KINDS = ['convocatoria', 'evento', 'entidad', 'propuesta'] as const;
export const BusinessKindSchema = z.enum(BUSINESS_KINDS);
export type BusinessKind = z.infer<typeof BusinessKindSchema>;

export const BusinessCardSchema = z.object({
  /** Repo-relative path of the record's Markdown, so every card links to its source. */
  path: z.string().min(1),
  /** Unresolved `[[...]]` markers in the record (or, for a proposal, its folder). */
  holes: z.number().int().min(0),
  id: z.string().min(1),
  kind: BusinessKindSchema,
  titulo: z.string().min(1),
  status: z.string().optional(),
  relacion: z.string().optional(),
  fit: z.enum(['high', 'medium', 'low']).optional(),
  deadline: z.string().optional(),
  convocante: z.string().optional(),
  importe: z.string().optional(),
  lugar: z.string().optional(),
  coste: z.string().optional(),
  plazas: z.string().optional(),
  tipo: z.string().optional(),
  para: z.string().optional(),
  url: z.string().optional(),
});
export type BusinessCard = z.infer<typeof BusinessCardSchema>;

const byKind = z.object({
  convocatoria: z.array(BusinessCardSchema),
  evento: z.array(BusinessCardSchema),
  entidad: z.array(BusinessCardSchema),
  propuesta: z.array(BusinessCardSchema),
});

export const BusinessSnapshotSchema = z.object({
  /** A date, not a timestamp: a timestamp would make every regeneration a diff. */
  generatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  counts: z.object({
    convocatoria: z.number().int().min(0),
    evento: z.number().int().min(0),
    entidad: z.number().int().min(0),
    propuesta: z.number().int().min(0),
  }),
  urgente: z.array(BusinessCardSchema.extend({ dias: z.number().int() })),
  caducadas: z.array(BusinessCardSchema),
  propuestasIncompletas: z.array(BusinessCardSchema),
  byKind,
});
export type BusinessSnapshot = z.infer<typeof BusinessSnapshotSchema>;

/** Whole days from `from` to `to`, both ISO dates. Negative once `to` is past. */
export function daysBetweenIsoDates(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}
