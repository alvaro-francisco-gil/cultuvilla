import { describe, it, expect } from 'vitest';
import {
  slugifyTerm,
  vocabularyTermId,
  buildVocabularyTermData,
  VocabularyTermDataSchema,
  VOCABULARY_TERM_KINDS,
  presentVocabularyKinds,
  vocabularyCreditsByTerm,
} from '../../src/models/vocabulary/VocabularyTermDataModel';
import {
  isSharedVocabularyKind,
  SHARED_VOCABULARY_KINDS,
  buildVocabularyWordData,
  VocabularyWordDataSchema,
} from '../../src/models/vocabulary/VocabularyWordDataModel';
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

  it('capitalizes the first letter so the listing does not mix "tenao" with "Melena"', () => {
    expect(buildVocabularyTermData({ ...input, term: 'tenao' }).term).toBe('Tenao');
    expect(buildVocabularyTermData({ ...input, term: 'ñapa' }).term).toBe('Ñapa');
    expect(buildVocabularyTermData({ ...input, term: 'ágora' }).term).toBe('Ágora');
  });

  it('capitalizes the first letter, not the opening ¿ or ¡ of a dicho', () => {
    expect(buildVocabularyTermData({ ...input, kind: 'dicho', term: '¡anda ya!' }).term).toBe('¡Anda ya!');
  });

  it('leaves the rest of the headword exactly as typed', () => {
    expect(buildVocabularyTermData({ ...input, term: 'el Tío Pedro' }).term).toBe('El Tío Pedro');
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

describe('shared vocabulary kinds', () => {
  // A word travels between villages; a nickname and a field name do not.
  it('shares palabras and dichos', () => {
    expect(isSharedVocabularyKind('palabra')).toBe(true);
    expect(isSharedVocabularyKind('dicho')).toBe(true);
  });

  it('never shares a mote or a topónimo — those name one village’s family and field', () => {
    expect(isSharedVocabularyKind('mote')).toBe(false);
    expect(isSharedVocabularyKind('toponimo')).toBe(false);
  });

  it('is the subset of the kinds a term can be', () => {
    for (const kind of SHARED_VOCABULARY_KINDS) {
      expect(VOCABULARY_TERM_KINDS).toContain(kind);
    }
  });

  it('builds a word whose id is the slug it shares with every village entry', () => {
    const word = buildVocabularyWordData({
      term: 'Esbardo',
      normalized: slugifyTerm('Esbardo'),
      kind: 'palabra',
      villageCount: 2,
      firstMunicipalityId: '40123',
    });
    expect(() => VocabularyWordDataSchema.parse(word)).not.toThrow();
    expect(word.normalized).toBe('esbardo');
    expect(word.updatedAt).toEqual(word.createdAt);
  });
});

describe('presentVocabularyKinds', () => {
  it('lists only the kinds a village has recorded, in the fixed kind order', () => {
    const kinds = presentVocabularyKinds([{ kind: 'dicho' }, { kind: 'palabra' }, { kind: 'dicho' }]);
    expect(kinds).toEqual(['palabra', 'dicho']);
  });

  it('is empty for a village with no words', () => {
    expect(presentVocabularyKinds([])).toEqual([]);
  });
});

describe('vocabularyCreditsByTerm', () => {
  const terms = [
    { id: 't1', contributorUserIds: ['ana'], contributorOrgIds: ['pena'] },
    { id: 't2', contributorUserIds: ['luis'], contributorOrgIds: [] },
  ];

  // A row credits everyone who put anything into the word — whoever recorded it
  // and whoever added a meaning since — each once, the word's own credit first.
  it('merges the word’s credit with every meaning’s, without repeats', () => {
    const credits = vocabularyCreditsByTerm(terms, [
      { termId: 't1', contributorUserIds: ['ana', 'eva'], contributorOrgIds: ['pena', 'podcast'] },
      { termId: 't1', contributorUserIds: ['eva', 'jose'], contributorOrgIds: [] },
    ]);
    expect(credits.get('t1')).toEqual({
      userIds: ['ana', 'eva', 'jose'],
      orgIds: ['pena', 'podcast'],
    });
  });

  it('keeps the word’s own credit when nobody added a meaning', () => {
    expect(vocabularyCreditsByTerm(terms, []).get('t2')).toEqual({ userIds: ['luis'], orgIds: [] });
  });

  it('ignores meanings of words it was not asked about', () => {
    const credits = vocabularyCreditsByTerm(terms, [
      { termId: 'gone', contributorUserIds: ['x'], contributorOrgIds: [] },
    ]);
    expect([...credits.keys()]).toEqual(['t1', 't2']);
  });
});
