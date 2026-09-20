/**
 * Registry of business-side opportunities: funding calls, events worth
 * attending, and the entities behind them. Pure parsing + validation, no fs —
 * the CLI ([../opportunities-cli.mjs](../opportunities-cli.mjs)) owns the disk.
 *
 * Mirrors the backfill registry's lib/cli split so the rules are unit-testable
 * without fixtures on disk.
 */

/** Directory under `project/` -> the `kind` every record in it must declare. */
export const KIND_BY_DIR = {
  convocatorias: 'convocatoria',
  eventos: 'evento',
  entidades: 'entidad',
};

export const DIRS = Object.keys(KIND_BY_DIR);
export const KINDS = Object.values(KIND_BY_DIR);

/**
 * Two lifecycles on purpose. A funding call is won or lost; an event is
 * attended or skipped. Collapsing them into one generic enum would cost the
 * only distinction that matters when you look back at a year of records.
 */
export const STATUSES = {
  convocatoria: ['watching', 'candidate', 'preparing', 'submitted', 'won', 'lost', 'expired'],
  evento: ['watching', 'candidate', 'registered', 'attended', 'skipped', 'expired'],
};

/** Statuses that still expect work from us — the ones a lapsed deadline strands. */
export const OPEN_STATUSES = ['watching', 'candidate', 'preparing'];

/** An entity has no lifecycle, it has a relationship. */
export const RELACIONES = ['sin-contacto', 'contactado', 'conversando', 'colaborando', 'descartado'];

export const FITS = ['high', 'medium', 'low'];

const REQUIRED = {
  convocatoria: ['id', 'kind', 'titulo', 'status', 'fit'],
  evento: ['id', 'kind', 'titulo', 'status', 'fit'],
  entidad: ['id', 'kind', 'titulo', 'relacion', 'fit'],
};

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Flat-scalar frontmatter parser. The schema is deliberately flat (no nested
 * maps, no multi-line values), which is what makes 30 lines enough and keeps a
 * YAML dependency out of the root package for six fields.
 */
export function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text);
  if (!match) throw new Error('no frontmatter block (must open with `---` on line 1)');

  const data = {};
  for (const raw of match[1].split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const sep = line.indexOf(':');
    if (sep === -1) throw new Error(`frontmatter line is not \`key: value\`: ${line}`);
    const key = line.slice(0, sep).trim();
    let value = line.slice(sep + 1).trim();
    if (!key) throw new Error(`frontmatter line has an empty key: ${line}`);
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    if (key in data) throw new Error(`duplicate frontmatter key: ${key}`);
    data[key] = value;
  }
  return { data, body: text.slice(match[0].length) };
}

/**
 * Validate one record's frontmatter. `dir` and `slug` come from its path, so a
 * record cannot drift from where it is filed.
 * @returns {string[]} problems; empty means valid.
 */
export function validateRecord({ dir, slug, data }) {
  const problems = [];
  const expectedKind = KIND_BY_DIR[dir];
  if (!expectedKind) return [`unknown directory \`${dir}\` (expected one of ${DIRS.join(', ')})`];

  if (data.kind !== expectedKind) {
    problems.push(`kind is \`${data.kind ?? '(missing)'}\` but lives in ${dir}/ (expected \`${expectedKind}\`)`);
  }
  for (const field of REQUIRED[expectedKind]) {
    if (!data[field]) problems.push(`missing required field \`${field}\``);
  }
  if (data.id && data.id !== slug) {
    problems.push(`id \`${data.id}\` does not match filename \`${slug}.md\``);
  }
  if (data.id && !KEBAB.test(data.id)) problems.push(`id \`${data.id}\` is not kebab-case`);
  if (data.fit && !FITS.includes(data.fit)) {
    problems.push(`fit \`${data.fit}\` is not one of ${FITS.join(' | ')}`);
  }

  if (expectedKind === 'entidad') {
    if (data.status) problems.push('an entidad has no `status` — use `relacion`');
    if (data.relacion && !RELACIONES.includes(data.relacion)) {
      problems.push(`relacion \`${data.relacion}\` is not one of ${RELACIONES.join(' | ')}`);
    }
  } else {
    if (data.relacion) problems.push(`a ${expectedKind} has no \`relacion\` — use \`status\``);
    const allowed = STATUSES[expectedKind];
    if (data.status && !allowed.includes(data.status)) {
      problems.push(`status \`${data.status}\` is not one of ${allowed.join(' | ')}`);
    }
  }

  for (const field of ['deadline', 'inicio', 'fin']) {
    if (data[field] && !ISO_DATE.test(data[field])) {
      problems.push(`${field} \`${data[field]}\` is not an ISO date (YYYY-MM-DD)`);
    }
  }
  return problems;
}

/** Ids must be unique across the whole tree, not just within a directory. */
export function findDuplicateIds(records) {
  const seen = new Map();
  const dupes = [];
  for (const record of records) {
    const id = record.data.id;
    if (!id) continue;
    if (seen.has(id)) dupes.push({ id, paths: [seen.get(id), record.path] });
    else seen.set(id, record.path);
  }
  return dupes;
}

const dayMs = 86_400_000;

/** Whole days from `today` until `deadline`; negative once it has lapsed. */
export function daysUntil(deadline, today) {
  const target = Date.parse(`${deadline}T00:00:00Z`);
  const from = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(target) || Number.isNaN(from)) return null;
  return Math.round((target - from) / dayMs);
}

/**
 * Records whose deadline has lapsed while their status still says we intend to
 * act. These are WARNINGS, never errors: time passes on its own, so failing the
 * build here would turn an unrelated PR red on a Tuesday for nobody's fault.
 * Resist "tightening" this into an error.
 */
export function findStranded(records, today) {
  return records
    .filter((r) => r.data.deadline && OPEN_STATUSES.includes(r.data.status))
    .filter((r) => (daysUntil(r.data.deadline, today) ?? 0) < 0);
}

/** Open records whose deadline falls inside the next `window` days. */
export function findUpcoming(records, today, window = 30) {
  return records
    .filter((r) => r.data.deadline && OPEN_STATUSES.includes(r.data.status))
    .map((r) => ({ ...r, days: daysUntil(r.data.deadline, today) }))
    .filter((r) => r.days !== null && r.days >= 0 && r.days <= window)
    .sort((a, b) => a.days - b.days);
}
