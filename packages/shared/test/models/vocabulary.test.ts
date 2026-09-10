import { describe, it, expect } from 'vitest';
import {
  slugifyTerm,
  vocabularyTermId,
  buildVocabularyTermData,
  VocabularyTermDataSchema,
  VOCABULARY_TERM_KINDS,
} from '../../src/models/vocabulary/VocabularyTermDataModel';
import {
  buildVocabularyDefinitionData,
  VocabularyDefinitionDataSchema,
} from '../../src/models/vocabulary/VocabularyDefinitionDataModel';

describe('slugifyTerm', () => {
  it('folds case and accents so one word cannot fork into two docs', () => {
    expect(slugifyTerm('Esbardo')).toBe('esbardo');
    expect(slugifyTerm('  ESBARDO ')).toBe('esbardo');
    expect(slugifyTerm('Ñapa')).toBe('napa');
    expect(slugifyTerm('cantarería')).toBe('cantareria');
  });

  it('collapses punctuation and spacing in a dicho to single dashes', () => {
    expect(slugifyTerm('A buenas horas, mangas verdes')).toBe('a-buenas-horas-mangas-verdes');
    expect(slugifyTerm('¡Anda ya!')).toBe('anda-ya');
  });

  it('leaves no leading or trailing dash to sort ahead of every real word', () => {
    expect(slugifyTerm('  ¿qué?  ')).toBe('que');
  });
});

describe('vocabularyTermId', () => {
  it('scopes the derived id to the pueblo, so two villages keep their own word', () => {
    expect(vocabularyTermId('33001', 'Esbardo')).toBe('33001__esbardo');
    expect(vocabularyTermId('47001', 'Esbardo')).toBe('47001__esbardo');
  });

  it('is stable across how the contributor happened to type it', () => {
    expect(vocabularyTermId('33001', 'esbardo')).toBe(vocabularyTermId('33001', ' ESBARDO '));
  });
});

describe('buildVocabularyTermData', () => {
  const input = {
    municipalityId: '33001',
    term: '  Ñapa  ',
    kind: 'palabra' as const,
    createdBy: 'alice',
  };

  it('produces a doc that parses under its own strict schema', () => {
    expect(() => VocabularyTermDataSchema.parse(buildVocabularyTermData(input))).not.toThrow();
  });

  it('keeps the headword verbatim but normalizes the sort key', () => {
    const data = buildVocabularyTermData(input);
    expect(data.term).toBe('Ñapa');
    expect(data.normalized).toBe('napa');
  });

  it('starts every counter at zero and the term visible', () => {
    const data = buildVocabularyTermData(input);
    expect(data.definitionCount).toBe(0);
    expect(data.commentCount).toBe(0);
    expect(data.readCount).toBe(0);
    expect(data.status).toBe('active');
    expect(data.hiddenBy).toBeNull();
  });

  it('rejects a kind outside the declared set', () => {
    expect(() =>
      VocabularyTermDataSchema.parse({
        ...buildVocabularyTermData(input),
        kind: 'insulto',
      }),
    ).toThrow();
  });

  it('credits the author as the word’s digitalizer even when nobody else is named', () => {
    const data = buildVocabularyTermData(input);
    expect(data.contributorUserIds).toEqual(['alice']);
    expect(data.contributorOrgIds).toEqual([]);
  });

  it('credits everyone picked, author first and once', () => {
    const data = buildVocabularyTermData({
      ...input,
      contributorUserIds: ['bob', 'alice'],
      contributorOrgIds: ['peña-el-botijo'],
    });
    expect(data.contributorUserIds).toEqual(['alice', 'bob']);
    expect(data.contributorOrgIds).toEqual(['peña-el-botijo']);
  });

  it('declares the four kinds the UI renders', () => {
    expect([...VOCABULARY_TERM_KINDS]).toEqual(['palabra', 'dicho', 'mote', 'toponimo']);
  });
});

describe('buildVocabularyDefinitionData', () => {
  const input = {
    municipalityId: '33001',
    termId: '33001__esbardo',
    definition: '  Cría de oso.  ',
    createdBy: 'bob',
  };

  it('produces a doc that parses under its own strict schema', () => {
    expect(() =>
      VocabularyDefinitionDataSchema.parse(buildVocabularyDefinitionData(input)),
    ).not.toThrow();
  });

  it('stores an omitted or blank optional field as null, never as an empty string', () => {
    const data = buildVocabularyDefinitionData({ ...input, example: '   ', castellano: undefined });
    expect(data.example).toBeNull();
    expect(data.castellano).toBeNull();
  });

  it('trims the definition and seeds updatedAt from createdAt', () => {
    const data = buildVocabularyDefinitionData(input);
    expect(data.definition).toBe('Cría de oso.');
    expect(data.updatedAt).toEqual(data.createdAt);
  });

  it('credits the author of a meaning even when nobody else is named', () => {
    expect(buildVocabularyDefinitionData(input).contributorUserIds).toEqual(['bob']);
  });

  it('rejects a definition longer than the rules allow', () => {
    expect(() =>
      VocabularyDefinitionDataSchema.parse({
        ...buildVocabularyDefinitionData(input),
        definition: 'x'.repeat(1001),
      }),
    ).toThrow();
  });
});
