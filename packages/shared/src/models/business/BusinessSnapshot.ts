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

/**
 * Where a fiesta's date came from, because the two are not equally trustworthy.
 *
 * `bop` is one of the two *fiestas locales* a municipality declares each year in
 * the provincial bulletin. That is the liturgical anchor of the main núcleo, NOT
 * the week the pueblo actually celebrates: Matabuena declares 16 and 25 July and
 * holds four fiesta windows, the biggest of them 22–28 August. `verificada` is a
 * window confirmed against a dated public source (ayuntamiento, local press).
 *
 * The panel renders them differently on purpose — a `bop` date presented as the
 * semana de fiestas is worse than no date at all.
 */
export const FiestaSourceSchema = z.enum(['bop', 'verificada']);
export type FiestaSource = z.infer<typeof FiestaSourceSchema>;

export const FiestaSchema = z.object({
  /** Month-day, `MM-DD`. A fiesta recurs; the year it next falls in is computed. */
  md: z.string().regex(/^\d{2}-\d{2}$/),
  nombre: z.string().min(1),
  fuente: FiestaSourceSchema,
  /** Human phrasing for a fiesta with no fixed date ("penúltimo fin de semana de agosto"). */
  cuando: z.string().optional(),
});
export type Fiesta = z.infer<typeof FiestaSchema>;

export const PuebloSchema = z.object({
  nombre: z.string().min(1),
  provincia: z.string().min(1),
  /** Great-circle km from the reference pueblo; 0 for the reference itself. */
  km: z.number().min(0),
  habitantes: z.number().int().min(0),
  anillo: z.enum(['referencia', '1', '2', '3']),
  fiestas: z.array(FiestaSchema),
});
export type Pueblo = z.infer<typeof PuebloSchema>;

export const FiestasDatasetSchema = z.object({
  referencia: z.string().min(1),
  actualizado: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nota: z.string().min(1),
  pueblos: z.array(PuebloSchema),
});
export type FiestasDataset = z.infer<typeof FiestasDatasetSchema>;

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
  /**
   * Optional because the registry predates it: an older committed snapshot must
   * still parse rather than blanking the whole panel over a new section.
   */
  fiestas: FiestasDatasetSchema.optional(),
});
export type BusinessSnapshot = z.infer<typeof BusinessSnapshotSchema>;

/** Whole days from `from` to `to`, both ISO dates. Negative once `to` is past. */
export function daysBetweenIsoDates(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * The ISO date on which `md` (a `MM-DD` recurrence) next falls, counting today.
 *
 * Computed rather than stored, for the same reason the panel recomputes deadline
 * day counts: the snapshot is only as fresh as the last deploy, and a fiesta
 * calendar that silently reports last year's date is worse than none.
 *
 * String comparison, not `Date` arithmetic, so 29 February survives a non-leap
 * year instead of being normalised into 1 March.
 */
export function nextOccurrence(md: string, todayIso: string): string {
  if (!/^\d{2}-\d{2}$/.test(md)) throw new Error(`not a MM-DD month-day: ${md}`);
  const month = Number(md.slice(0, 2));
  const day = Number(md.slice(3));
  if (month < 1 || month > 12 || day < 1 || day > 31) throw new Error(`not a calendar day: ${md}`);
  let year = Number(todayIso.slice(0, 4));
  if (md < todayIso.slice(5)) year += 1;
  // 29 February exists once every four years. Advancing to a year where the day
  // is real keeps the result a parseable date; returning `2027-02-29` would make
  // every consumer's `Date.parse` yield NaN, which renders as "today".
  while (!isRealDay(year, month, day)) year += 1;
  return `${String(year)}-${md}`;
}

function isRealDay(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}
