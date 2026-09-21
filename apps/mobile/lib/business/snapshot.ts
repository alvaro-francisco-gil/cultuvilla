/**
 * Typed view of the generated business snapshot.
 *
 * The registry lives as Markdown in `project/`, not in Firestore, so the
 * dashboard reads a snapshot produced at build time by
 * `pnpm business:snapshot`. `pnpm business:snapshot --check` runs in CI and
 * fails if the committed JSON has drifted from the Markdown.
 */
import data from './snapshot.json';

export type BusinessKind = 'convocatoria' | 'evento' | 'entidad' | 'propuesta';

export type BusinessCard = {
  path: string;
  holes: number;
  id: string;
  kind: BusinessKind;
  titulo: string;
  status?: string;
  relacion?: string;
  fit?: 'high' | 'medium' | 'low';
  deadline?: string;
  convocante?: string;
  importe?: string;
  lugar?: string;
  coste?: string;
  plazas?: string;
  tipo?: string;
  para?: string;
  url?: string;
};

export type BusinessSnapshot = {
  generatedAt: string;
  counts: Record<BusinessKind, number>;
  urgente: (BusinessCard & { dias: number })[];
  caducadas: BusinessCard[];
  propuestasIncompletas: BusinessCard[];
  byKind: Record<BusinessKind, BusinessCard[]>;
};

export const snapshot = data as BusinessSnapshot;

const REPO = 'https://github.com/alvaro-francisco-gil/cultuvilla/blob/develop';

/** The card shows the frontmatter; the reasoning stays in git, one tap away. */
export function sourceUrl(card: BusinessCard): string {
  return `${REPO}/${card.path}`;
}

/**
 * Whole days between the snapshot's date and today. The business half is only
 * as fresh as the last deploy, so the screen says so rather than implying live
 * data — a stale deadline count is worse than an admitted one.
 */
export function snapshotAgeDays(generatedAt: string, now: Date = new Date()): number {
  const from = Date.parse(`${generatedAt}T00:00:00Z`);
  const to = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

/** Days until a deadline, recomputed against today rather than trusted from the file. */
export function diasHasta(deadline: string, now: Date = new Date()): number {
  const target = Date.parse(`${deadline}T00:00:00Z`);
  const from = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((target - from) / 86_400_000);
}
