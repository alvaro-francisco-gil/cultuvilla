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
 * How much authority a fiesta's date carries.
 *
 * `declarada` is one of the two *fiestas locales* a municipality declares each
 * year in the provincial bulletin. That is the liturgical anchor of the main
 * núcleo, NOT the week the pueblo celebrates: Matabuena declares 16 and 25 July
 * and holds four fiesta windows, the biggest of them 22–28 August.
 * `verificada` is a window confirmed against a dated public source, named in
 * `fuente`.
 *
 * The panel renders them differently on purpose — a declared date presented as
 * the semana de fiestas is worse than no date at all.
 */
export const FiestaTipoSchema = z.enum(['declarada', 'verificada']);

/**
 * A real day in the Gregorian calendar, not merely `NN-NN`.
 *
 * Shape alone would admit `99-99` and `02-31`, which reach `Date.parse` as NaN
 * downstream and render as "today" — a fabricated fiesta rather than a rejected
 * dataset. 29 February is accepted here because a month-day carries no year;
 * `nextFiestaOccurrence` advances it to a leap year.
 */
function isRealMonthDay(md: string): boolean {
  const month = Number(md.slice(0, 2));
  const day = Number(md.slice(3));
  if (month < 1 || month > 12) return false;
  const longest = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  return day >= 1 && day <= longest;
}


/** `MM-DD` that is also a day that exists. */
export const MonthDaySchema = z
  .string()
  .regex(/^\d{2}-\d{2}$/)
  .refine(isRealMonthDay, 'not a day that exists in the calendar');

/** `YYYY-MM-DD` that is also a day that exists. */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isRealIsoDate, 'not a day that exists in the calendar');
export type FiestaTipo = z.infer<typeof FiestaTipoSchema>;

/**
 * A moveable feast's rule. `weekday` is ISO (1 = Monday … 7 = Sunday); `n` is
 * the 1-based occurrence in the month, or negative from the end (-1 = last,
 * -2 = "penúltimo").
 *
 * This exists because the bulletin mixes two incompatible kinds of date and
 * spells them identically. San Miguel is always 29 September. "5 October 2026"
 * is the *first Sunday of October* observed on the Monday — freeze that as a
 * month-day and the calendar is quietly wrong from 2027 on.
 */
export const ReglaSchema = z.object({
  n: z.number().int().min(-4).max(5).refine((v) => v !== 0, 'n is 1-based or negative from the end'),
  weekday: z.number().int().min(1).max(7),
  month: z.number().int().min(1).max(12),
});
export type Regla = z.infer<typeof ReglaSchema>;

export const FiestaSchema = z.object({
  /**
   * Month-day, `MM-DD`. For a fixed feast this IS the date. For a moveable one
   * it is only a sort anchor and a fallback — `regla` is the truth.
   */
  md: MonthDaySchema,
  nombre: z.string().min(1),
  tipo: FiestaTipoSchema,
  recurrencia: z.enum(['fija', 'movil']),
  regla: ReglaSchema.optional(),
  /**
   * Where this came from: a URL, or a citation precise enough to reopen ("BOP
   * Segovia 19-09-2025"). Required by project/AGENTS.md — a record whose origin
   * nobody can retrace is a record nobody trusts in three months.
   */
  fuente: z.string().min(1),
  /** ISO date this was last checked against `fuente`. */
  verificadoEl: IsoDateSchema,
  /** Human phrasing of the window ("22–28 de agosto", "penúltimo fin de semana"). */
  cuando: z.string().optional(),
});
export type Fiesta = z.infer<typeof FiestaSchema>;

export const PuebloSchema = z.object({
  nombre: z.string().min(1),
  provincia: z.string().min(1),
  /** Great-circle km from the reference pueblo's centroid; 0 for the reference. */
  km: z.number().min(0),
  habitantes: z.number().int().min(0),
  anillo: z.enum(['referencia', '1', '2', '3']),
  fiestas: z.array(FiestaSchema),
  /**
   * Open questions, in the repo's `[[confirmar: …]]` marker so one grep over
   * project/ finds them. A pueblo with no verified week carries one: that is
   * what distinguishes "searched, nothing published" from "never looked".
   */
  confirmar: z.array(z.string()).optional(),
});
export type Pueblo = z.infer<typeof PuebloSchema>;

/**
 * What a sweep actually covered.
 *
 * Without this, a pueblo's ABSENCE means nothing — 20 km and 300 km produce very
 * different datasets and an identical-looking file. Recorded per sweep, because
 * widening the radius later must not make the earlier pass look incomplete: a
 * pueblo missing inside a radius already swept is a gap, one outside every
 * radius swept was simply never in scope.
 */
export const BarridoSchema = z.object({
  fecha: IsoDateSchema,
  radioKm: z.number().positive(),
  provincias: z.array(z.string().min(1)).min(1),
  /** The year whose declared fiestas this sweep read. */
  anioBop: z.number().int().min(2000).max(2100),
  pueblosHallados: z.number().int().min(0),
  nota: z.string().optional(),
});
export type Barrido = z.infer<typeof BarridoSchema>;

export const CoberturaSchema = z.object({
  /** Widest radius ever swept. Inside it, absence is a gap; outside, out of scope. */
  radioKm: z.number().positive(),
  centro: z.object({ nombre: z.string().min(1), lat: z.number(), lon: z.number() }),
  /**
   * How distance was measured, so a later, wider sweep produces comparable
   * numbers instead of a second incompatible set of rings.
   */
  metodo: z.string().min(1),
  barridos: z.array(BarridoSchema).min(1),
});
export type Cobertura = z.infer<typeof CoberturaSchema>;

export const FiestasDatasetSchema = z.object({
  referencia: z.string().min(1),
  actualizado: IsoDateSchema,
  /** The bulletin year the declared dates come from. `fiestas:verify` gates this. */
  anioBop: z.number().int().min(2000).max(2100),
  nota: z.string().min(1),
  cobertura: CoberturaSchema,
  /**
   * At least one, because a dataset with no pueblos describes no coverage and
   * makes every ratio computed from it undefined. An individual pueblo MAY have
   * zero fiestas — that is the point of recording coverage: a municipality
   * inside the swept radius that we found and for which nothing is published
   * yet must still appear, or its absence would read as "out of scope".
   */
  pueblos: z.array(PuebloSchema).min(1),
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
 * The ISO date a fiesta falls on in `year`.
 *
 * A fixed feast is its month-day. A moveable one is computed from `regla` every
 * year — which is the whole point: the bulletin publishes "5 October" for what
 * is really "the first Sunday of October, observed Monday", and a frozen
 * month-day would be wrong from the next year on. A moveable feast with no rule
 * yet falls back to its anchor rather than disappearing.
 */
export function resolveFiestaDate(fiesta: Fiesta, year: number): string {
  if (fiesta.recurrencia === 'fija' || !fiesta.regla) return `${String(year)}-${fiesta.md}`;
  return nthWeekdayOfMonth(year, fiesta.regla);
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** ISO weekday (1 = Monday … 7 = Sunday) of a UTC date. */
function isoWeekday(year: number, month: number, day: number): number {
  const js = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return js === 0 ? 7 : js;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function nthWeekdayOfMonth(year: number, regla: Regla): string {
  const { n, weekday, month } = regla;
  const total = daysInMonth(year, month);
  const matching: number[] = [];
  for (let day = 1; day <= total; day += 1) {
    if (isoWeekday(year, month, day) === weekday) matching.push(day);
  }
  // Negative counts from the end: -1 is the last, -2 the "penúltimo".
  // A month has only four of a given weekday in most years, so `n = 5` (and a
  // deep negative) can miss; clamp to the nearest end rather than returning
  // nothing, which would drop the fiesta off the calendar entirely.
  const index = n > 0 ? Math.min(n - 1, matching.length - 1) : Math.max(matching.length + n, 0);
  const chosen = matching[index] ?? 1;
  return `${String(year)}-${pad(month)}-${pad(chosen)}`;
}

/**
 * The ISO date of the fiesta's next occurrence, counting today.
 *
 * Computed rather than stored, for the same reason the panel recomputes deadline
 * day counts: the snapshot is only as fresh as the last deploy, and a calendar
 * that silently reports last year's date is worse than none.
 */
export function nextFiestaOccurrence(fiesta: Fiesta, todayIso: string): string {
  const year = Number(todayIso.slice(0, 4));
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const date = resolveFiestaDate(fiesta, year + attempt);
    // 29 February only exists every four years; an impossible day is skipped
    // rather than returned, because `Date.parse` would yield NaN downstream and
    // render as "today".
    if (date >= todayIso && isRealIsoDate(date)) return date;
  }
  return resolveFiestaDate(fiesta, year);
}

function isRealIsoDate(iso: string): boolean {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/**
 * The oldest `anioBop` a fiestas dataset may carry and still be current.
 *
 * The provincial bulletin publishes year Y+1's local holidays in about September
 * of year Y — Segovia's 2026 list was resolved on 16-09-2025 and published three
 * days later. The grace runs to 30 September so a refresh is due exactly when
 * the new resolution is actually out, not the moment the year turns.
 */
export function minimumBopYear(todayIso: string): number {
  const year = Number(todayIso.slice(0, 4));
  const month = Number(todayIso.slice(5, 7));
  return month >= 10 ? year + 1 : year;
}
