import { z } from 'zod';
import { VOCABULARY_TERM_KINDS, VocabularyTermKindSchema, type VocabularyTermKind } from './VocabularyTermDataModel';

/**
 * The kinds that are the *same word* in two villages. A `palabra` or a `dicho`
 * travels: "esbardo" in one pueblo is the same word as "esbardo" in the next,
 * even where the meaning has drifted.
 *
 * `mote` and `toponimo` deliberately do NOT. A mote names one village's family
 * and a topónimo names one village's field — "El Cerro" in two pueblos is two
 * different places, so merging them would be a factual error, not tidiness.
 */
export const SHARED_VOCABULARY_KINDS = ['palabra', 'dicho'] as const satisfies readonly VocabularyTermKind[];

export function isSharedVocabularyKind(kind: string): boolean {
  return (SHARED_VOCABULARY_KINDS as readonly string[]).includes(kind);
}

/**
 * One word, across every village that records it. Stored at
 * `vocabularyWords/{slug}` — the same slug that keys each village's own entry,
 * without the municipality half.
 *
 * A **read model, not a source**: a word exists precisely because some village
 * recorded it, so `syncVocabularyWordIndex` derives this from `vocabularyTerms`
 * and deletes it when the last village drops the word. Clients never write it
 * (firestore.rules), which is what stops one villager from redefining a word's
 * spelling for everybody.
 *
 * It exists so that searching for an existing word returns one row per *word*
 * rather than one per village — otherwise a word used in twenty pueblos would
 * fill a suggestion list on its own.
 */
export const VocabularyWordDataSchema = z.object({
  /** Display spelling, taken from the village that recorded it first. */
  term: z.string().min(1).max(80),
  normalized: z.string().min(1).max(80),
  kind: VocabularyTermKindSchema,
  /** How many villages currently have this word, counting active entries only. */
  villageCount: z.number().int(),
  /** Where it was first written down — the pueblo that put it on the map. */
  firstMunicipalityId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type VocabularyWordData = z.infer<typeof VocabularyWordDataSchema>;

export interface VocabularyWordDataInput {
  term: string;
  normalized: string;
  kind: VocabularyTermKind;
  villageCount: number;
  firstMunicipalityId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function buildVocabularyWordData(input: VocabularyWordDataInput): VocabularyWordData {
  const createdAt = input.createdAt ?? new Date();
  return {
    term: input.term,
    normalized: input.normalized,
    kind: input.kind,
    villageCount: input.villageCount,
    firstMunicipalityId: input.firstMunicipalityId,
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
  };
}

export { VOCABULARY_TERM_KINDS };
