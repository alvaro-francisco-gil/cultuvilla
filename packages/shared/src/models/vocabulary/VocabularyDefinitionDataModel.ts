import { z } from 'zod';
import { visibilityFields, defaultVisibility } from '../core/VisibilityModel';

/**
 * One villager's meaning for one term. Stored top-level at
 * `vocabularyDefinitions/{definitionId}`, pointing at its term by `termId` and
 * carrying `municipalityId` for the usual village scoping.
 *
 * Separate from the term itself because the whole point of a crowdsourced
 * vocabulary is that a word can mean two things in two barrios, and both are
 * worth keeping. Nobody's definition overwrites anybody else's — you add yours
 * beside theirs.
 */
export const VocabularyDefinitionDataSchema = z.object({
  municipalityId: z.string(),
  termId: z.string(),
  definition: z.string().min(1).max(1000),
  /**
   * The term used in a real sentence. Optional, but for a dialect word this is
   * often the part that actually preserves it — a bare gloss loses the register
   * and the grammar along with it.
   */
  example: z.string().max(500).nullable(),
  /** The nearest standard-Castilian equivalent, when there is one. */
  castellano: z.string().max(200).nullable(),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  ...visibilityFields,
});
export type VocabularyDefinitionData = z.infer<typeof VocabularyDefinitionDataSchema>;

export interface VocabularyDefinitionDataInput {
  municipalityId: string;
  termId: string;
  definition: string;
  example?: string | null;
  castellano?: string | null;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildVocabularyDefinitionData(
  input: VocabularyDefinitionDataInput,
): VocabularyDefinitionData {
  const createdAt = input.createdAt ?? new Date();
  return {
    municipalityId: input.municipalityId,
    termId: input.termId,
    definition: input.definition.trim(),
    example: trimmedOrNull(input.example),
    castellano: trimmedOrNull(input.castellano),
    createdBy: input.createdBy,
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    ...defaultVisibility(),
  };
}
