/**
 * Pure helpers for `scripts/mirror-prod-village.mjs` — the prod → local-emulator
 * village mirror.
 *
 * Kept separate from the CLI driver so the safety guard, the copy plan and the
 * anonymizer are unit-testable with `node --test` and no emulator.
 */

/** Fields scrubbed by --anonymize, per collection. */
const PII_FIELDS = {
  users: ['displayName', 'email', 'photoURL', 'phone'],
  persons: ['name', 'surname', 'email', 'photoURL', 'phone', 'birthday'],
  municipalityPeople: ['name', 'surname', 'photoURL'],
  registrations: ['name', 'photoURL'],
  registrationPrivate: ['phone', 'birthday', 'answers'],
  comments: ['authorName', 'authorPhotoURL'],
};

/**
 * What gets copied, in dependency order.
 *
 * `scope` says how a collection is found:
 *   'doc'         — the single municipality document
 *   'municipality'— top-level, filtered by `municipalityId`
 *   'subcollection'— nested under the municipality doc
 *   'perEvent'    — nested under each mirrored event (registrations carry no
 *                   municipalityId, so they can only be reached this way)
 *   'viaProjection'— fetched by id, from ids collected out of an already-mirrored
 *                   read model (persons are linked by a `municipalityLinks`
 *                   array of objects, which Firestore cannot query by one field)
 */
export const MIRROR_PLAN = [
  { collection: 'municipalities', scope: 'doc' },
  { collection: 'members', scope: 'subcollection' },
  { collection: 'barrios', scope: 'subcollection' },
  { collection: 'places', scope: 'subcollection' },
  { collection: 'municipalityPeople', scope: 'municipality' },
  { collection: 'persons', scope: 'viaProjection', from: 'municipalityPeople', idField: 'personId' },
  { collection: 'organizations', scope: 'municipality' },
  { collection: 'events', scope: 'municipality' },
  { collection: 'registrations', scope: 'perEvent' },
  { collection: 'registrationPrivate', scope: 'perEvent' },
  { collection: 'festivalPosters', scope: 'municipality' },
  { collection: 'news', scope: 'municipality' },
  { collection: 'comments', scope: 'municipality' },
];

/**
 * The guard that makes this script safe to point at prod: the TARGET must be an
 * emulator. A mirror writes hundreds of documents, so a target misconfigured to
 * a real project would not be a small mistake — it would overwrite a live
 * village with a copy of another one.
 *
 * Two independent conditions must both hold, so neither a stray env var nor a
 * typo'd project id alone is enough to reach real data.
 */
export function assertEmulatorTarget({ emulatorHost, targetProjectId, realProjectIds }) {
  if (!emulatorHost) {
    throw new Error(
      'FIRESTORE_EMULATOR_HOST is not set. The mirror only ever writes to a local emulator.\n' +
        '       Start the emulator and export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080',
    );
  }
  if (realProjectIds.includes(targetProjectId)) {
    throw new Error(
      `Refusing to mirror into "${targetProjectId}" — that is a real Firebase project.\n` +
        '       The emulator target must use a throwaway project id (default: cultuvilla-test).',
    );
  }
  return true;
}

/** Deterministic pseudonym, so the same person reads consistently across collections. */
export function pseudonym(seed, salt = 'v1') {
  let hash = 0;
  const input = `${salt}:${seed}`;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return `Vecino ${Math.abs(hash) % 9000 + 1000}`;
}

/**
 * Scrub the PII fields for `collection`. Structure, counts and every id are
 * preserved — only the human-readable values change, so distributions and
 * joins still behave like the real thing.
 */
export function anonymizeDoc(collection, id, data) {
  const fields = PII_FIELDS[collection];
  if (!fields) return data;
  const out = { ...data };
  for (const field of fields) {
    if (!(field in out) || out[field] === null || out[field] === undefined) continue;
    if (field === 'photoURL') out[field] = null;
    else if (field === 'email') out[field] = `${id}@example.invalid`;
    else if (field === 'answers') out[field] = {};
    else if (field === 'birthday') out[field] = null;
    else if (field === 'phone') out[field] = '+34600000000';
    else out[field] = pseudonym(id, field);
  }
  return out;
}

/** Parse `--municipality=X --source=prod --anonymize --dry-run`. */
export function parseMirrorArgs(argv) {
  const args = { source: 'prod', anonymize: false, dryRun: false, municipality: null };
  for (const raw of argv) {
    const [key, value] = raw.startsWith('--') ? raw.slice(2).split('=') : [raw, undefined];
    if (key === 'municipality') args.municipality = value ?? null;
    else if (key === 'source') args.source = value ?? 'prod';
    else if (key === 'anonymize') args.anonymize = true;
    else if (key === 'dry-run') args.dryRun = true;
    else throw new Error(`Unknown argument "${raw}"`);
  }
  if (!args.municipality) throw new Error('Missing --municipality=<id|name>');
  return args;
}
