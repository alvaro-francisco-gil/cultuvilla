import { z } from 'zod';
import { visibilityFields, defaultVisibility } from '../core/VisibilityModel';

/**
 * What kind of local expression this is. A pueblo's vocabulary is not only
 * single words — a `dicho` (saying/refrán), a `mote` (a household nickname) and
 * a `toponimo` (the local name for a field, path or rock that appears on no
 * map) are the three that go missing fastest, so they are first-class from the
 * start rather than a later required-field migration.
 */
export const VOCABULARY_TERM_KINDS = ['palabra', 'dicho', 'mote', 'toponimo'] as const;
export const VocabularyTermKindSchema = z.enum(VOCABULARY_TERM_KINDS);
export type VocabularyTermKind = z.infer<typeof VocabularyTermKindSchema>;

/**
 * A word, saying or nickname belonging to one pueblo. Stored top-level at
 * `vocabularyTerms/{municipalityId}__{slug}`.
 *
 * The doc id is DERIVED, not minted (see `vocabularyTermId`): two villagers who
 * independently add "esbardo" land on the same document, so the term is a
 * genuinely shared object that several people enrich rather than a pile of
 * near-duplicate posts. The meanings themselves live in `vocabularyDefinitions`
 * — this doc carries only the headword and its counters.
 *
 * `normalized` is the accent-folded, lowercased form. It is what the
 * alphabetical listing sorts on, so "ñapa" and "Ñapa" file together and the
 * index does not depend on how the first contributor happened to type it.
 */
export const VocabularyTermDataSchema = z.object({
  municipalityId: z.string(),
  /** The headword exactly as the first contributor wrote it, accents and all. */
  term: z.string().min(1).max(80),
  normalized: z.string().min(1).max(80),
  kind: VocabularyTermKindSchema,
  createdBy: z.string(),
  createdAt: z.date(),
  /** Denormalized by `syncVocabularyDefinitionCount`; clients never write it. */
  definitionCount: z.number().int(),
  commentCount: z.number().int(),
  readCount: z.number().int(),
  ...visibilityFields,
});
export type VocabularyTermData = z.infer<typeof VocabularyTermDataSchema>;

export interface VocabularyTermDataInput {
  municipalityId: string;
  term: string;
  kind: VocabularyTermKind;
  createdBy: string;
  createdAt?: Date;
}

/**
 * Lowercase, trim, fold accents and collapse anything that is not a letter or
 * digit into a single dash. Mirrors `slugifyOccupation` — the same trick of
 * making the doc id the identity so differently cased/accented entries of one
 * word collide onto one doc instead of forking.
 *
 * Note this deliberately folds ñ → n: a slug is a key, not a rendering. The
 * display form keeps every accent, because `term` is stored verbatim.
 */
export function slugifyTerm(term: string): string {
  return term
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The deterministic document id for a term. `__` separates the two halves:
 * a municipalityId is an INE code (digits) and a slug can never contain an
 * underscore, so the pair round-trips unambiguously.
 */
export function vocabularyTermId(municipalityId: string, term: string): string {
  return `${municipalityId}__${slugifyTerm(term)}`;
}

export function buildVocabularyTermData(input: VocabularyTermDataInput): VocabularyTermData {
  const createdAt = input.createdAt ?? new Date();
  return {
    municipalityId: input.municipalityId,
    term: input.term.trim(),
    normalized: slugifyTerm(input.term),
    kind: input.kind,
    createdBy: input.createdBy,
    createdAt,
    definitionCount: 0,
    commentCount: 0,
    readCount: 0,
    ...defaultVisibility(),
  };
}
