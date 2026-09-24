import { slugify } from '../../utils/urls';
import { z } from 'zod';
import { visibilityFields, defaultVisibility } from '../core/VisibilityModel';
import { contributorFields, creditedUserIds } from '../core/ContributorsModel';

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
  /** The headword as the first contributor wrote it, accents and all — only the first letter is capitalized (`capitalizeTerm`). */
  term: z.string().min(1).max(80),
  normalized: z.string().min(1).max(80),
  kind: VocabularyTermKindSchema,
  createdBy: z.string(),
  /**
   * Who digitalized the word — the first villager to record it and whoever they
   * named with them. Fixed at creation, like the rest of the term: a later
   * villager who adds a meaning is credited on that meaning instead. Crediting
   * the word itself, not only its meanings, is deliberate — recording a word
   * nobody had written down is the contribution worth rewarding.
   */
  ...contributorFields,
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
  contributorUserIds?: string[];
  contributorOrgIds?: string[];
  createdAt?: Date;
}

/**
 * The term's key — the same `slugify` the URLs use, so a term's id and its
 * `/<pueblo>/palabra/<slug>` path always agree. Differently cased/accented
 * entries of one word collide onto one doc instead of forking; the display form
 * keeps every accent, because `term` is stored verbatim.
 */
export function slugifyTerm(term: string): string {
  return slugify(term);
}

/**
 * The deterministic document id for a term. `__` separates the two halves: a
 * slug can never contain an underscore, so the id splits unambiguously at the
 * last `__` — see `termSlugFromId`.
 */
export function vocabularyTermId(municipalityId: string, term: string): string {
  return `${municipalityId}__${slugifyTerm(term)}`;
}

/** The slug half of a term id — the `/<pueblo>/palabra/<slug>` segment. */
export function termSlugFromId(termId: string): string {
  return termId.slice(termId.lastIndexOf('__') + 2);
}

/**
 * Upper-cases the first letter, skipping an opening `¿`/`¡` so a dicho reads
 * "¡Anda ya!". Everything after it stays as typed — a mote like "el Tío Pedro"
 * carries capitals of its own that lower-casing would destroy.
 */
export function capitalizeTerm(term: string): string {
  return term.trim().replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase('es-ES'));
}

export function buildVocabularyTermData(input: VocabularyTermDataInput): VocabularyTermData {
  const createdAt = input.createdAt ?? new Date();
  return {
    municipalityId: input.municipalityId,
    term: capitalizeTerm(input.term),
    normalized: slugifyTerm(input.term),
    kind: input.kind,
    createdBy: input.createdBy,
    contributorUserIds: creditedUserIds(input.createdBy, input.contributorUserIds),
    contributorOrgIds: input.contributorOrgIds ?? [],
    createdAt,
    definitionCount: 0,
    commentCount: 0,
    readCount: 0,
    ...defaultVisibility(),
  };
}
