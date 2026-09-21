/**
 * Shape the `project/` registry into the snapshot the business dashboard renders.
 *
 * Pure: takes already-loaded records, returns a plain object. The registry lives
 * in git, not Firestore, so the dashboard reads a snapshot generated at build
 * time — which means this file decides everything the screen knows.
 */
import {
  KINDS,
  OPEN_STATUSES,
  daysUntil,
  findFalseReady,
  findStranded,
  findUpcoming,
  resolveProposalDeadlines,
} from './opportunities.mjs';

/** Frontmatter keys the dashboard renders; everything else is prose for git. */
const CARRIED = [
  'id', 'kind', 'titulo', 'status', 'relacion', 'fit', 'deadline',
  'convocante', 'importe', 'lugar', 'coste', 'plazas', 'tipo', 'para', 'url',
];

const FIT_ORDER = { high: 0, medium: 1, low: 2 };

function card(record, deadline = null) {
  const out = { path: record.path, holes: record.holes ?? 0 };
  for (const key of CARRIED) if (record.data[key]) out[key] = record.data[key];
  if (deadline && !out.deadline) out.deadline = deadline;
  return out;
}

/**
 * @param {object[]} records loaded registry records
 * @param {string} today ISO date, injected so the output is deterministic in tests
 * @param {object|null} fiestas the `project/mercado` pueblo dataset, or null when absent
 */
export function buildSnapshot(records, today, fiestas = null) {
  const inherited = new Map(
    resolveProposalDeadlines(records)
      .filter((p) => p.deadline)
      .map((p) => [p.proposal.data.id, p.deadline]),
  );

  const enriched = records.map((r) => {
    const deadline = r.data.deadline ?? inherited.get(r.data.id) ?? null;
    // Proposals use their own vocabulary, so map the two still-open states onto
    // the shared notion of "open" that the deadline sweeps key off.
    const status =
      r.data.kind === 'propuesta' && ['borrador', 'lista'].includes(r.data.status)
        ? 'candidate'
        : r.data.status;
    return { ...r, data: { ...r.data, deadline: deadline ?? undefined, status } };
  });

  const byKind = {};
  for (const kind of KINDS) {
    byKind[kind] = records
      .filter((r) => r.data.kind === kind)
      .map((r) => card(r, inherited.get(r.data.id)))
      .sort((a, b) => {
        // Soonest deadline first; then best fit; then alphabetical. A dashboard
        // sorted alphabetically would bury the thing that expires on Friday.
        if (a.deadline && b.deadline && a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1;
        if (a.deadline && !b.deadline) return -1;
        if (!a.deadline && b.deadline) return 1;
        const fit = (FIT_ORDER[a.fit] ?? 3) - (FIT_ORDER[b.fit] ?? 3);
        return fit !== 0 ? fit : a.titulo.localeCompare(b.titulo, 'es');
      });
  }

  return {
    generatedAt: today,
    counts: Object.fromEntries(KINDS.map((k) => [k, byKind[k].length])),
    urgente: findUpcoming(enriched, today).map((r) => ({
      ...card(r),
      dias: r.days,
    })),
    caducadas: findStranded(enriched, today).map((r) => card(r)),
    propuestasIncompletas: findFalseReady(records).map((r) => card(r, inherited.get(r.data.id))),
    byKind,
    // Omitted rather than emitted empty: the schema makes it optional so an
    // older snapshot still parses, and `undefined` drops out of the JSON.
    ...(fiestas ? { fiestas } : {}),
  };
}

/** Days until each open deadline, used by the tests and the staleness notice. */
export { daysUntil, OPEN_STATUSES };
