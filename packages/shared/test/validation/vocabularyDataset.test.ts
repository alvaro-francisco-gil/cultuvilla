import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildVocabularyTermData,
  buildVocabularyDefinitionData,
  slugifyTerm,
  vocabularyTermId,
  VocabularyTermDataSchema,
  VocabularyDefinitionDataSchema,
  VOCABULARY_TERM_KINDS,
} from '../../src/models/vocabulary';

// scripts/data/vocabulary/<village>.json holds vocabulary that was researched and
// verified offline (e.g. transcribed from a village podcast) and is waiting to be
// uploaded. Nothing reads these files at runtime, so a bad entry would only
// surface at upload time — as a converter crash on the term screen if it got
// through. These assertions push that failure back to CI: every entry must build
// into a doc the strict schemas accept.

const repoRoot = resolve(__dirname, '../../../..');
const vocabularyDir = resolve(repoRoot, 'scripts/data/vocabulary');
const municipalities = JSON.parse(
  readFileSync(resolve(repoRoot, 'scripts/data/municipalities-es.json'), 'utf8'),
) as { name: string; codigoINE: string }[];

const VERIFICATION_STATUSES = ['verified', 'unverified'] as const;

interface VocabularyEntry {
  term: string;
  kind: string;
  definition: string;
  castellano: string | null;
  example: string | null;
  said: { sourceId: string; episode: number; videoId: string; at: number; asSaid: string };
  verification: { status: string; notes: string; references: string[] };
}

interface VocabularyDataset {
  municipality: { name: string; codigoINE: string };
  sources: Record<string, { name: string; kind: string; url: string }>;
  curatedAt: string;
  entries: VocabularyEntry[];
}

const datasets = readdirSync(vocabularyDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => ({
    file,
    data: JSON.parse(readFileSync(resolve(vocabularyDir, file), 'utf8')) as VocabularyDataset,
  }));

describe('scripts/data/vocabulary datasets', () => {
  it('exist', () => {
    expect(datasets.length).toBeGreaterThan(0);
  });

  describe.each(datasets)('$file', ({ data }) => {
    it('names a real municipality by its INE code', () => {
      const match = municipalities.find((m) => m.codigoINE === data.municipality.codigoINE);
      expect(match?.name).toBe(data.municipality.name);
    });

    it('has no two entries that would collide on one term doc', () => {
      const slugs = data.entries.map((entry) => slugifyTerm(entry.term));
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it.each(data.entries.map((entry) => [entry.term, entry] as const))(
      '%s builds into schema-valid term and definition docs',
      (_term, entry) => {
        expect(VOCABULARY_TERM_KINDS).toContain(entry.kind);
        const municipalityId = 'municipality-under-test';
        const term = buildVocabularyTermData({
          municipalityId,
          term: entry.term,
          kind: entry.kind as (typeof VOCABULARY_TERM_KINDS)[number],
          createdBy: 'uploader',
        });
        expect(() => VocabularyTermDataSchema.parse(term)).not.toThrow();

        const definition = buildVocabularyDefinitionData({
          municipalityId,
          termId: vocabularyTermId(municipalityId, entry.term),
          definition: entry.definition,
          example: entry.example,
          castellano: entry.castellano,
          createdBy: 'uploader',
        });
        expect(() => VocabularyDefinitionDataSchema.parse(definition)).not.toThrow();
      },
    );

    it.each(data.entries.map((entry) => [entry.term, entry] as const))(
      '%s records where it was said and how it was checked',
      (_term, entry) => {
        expect(data.sources[entry.said.sourceId]).toBeDefined();
        expect(entry.said.videoId).toMatch(/^[A-Za-z0-9_-]{11}$/);
        expect(Number.isInteger(entry.said.at) && entry.said.at >= 0).toBe(true);
        expect(entry.said.asSaid.trim()).not.toBe('');
        expect(VERIFICATION_STATUSES).toContain(entry.verification.status);
        if (entry.verification.status === 'verified') {
          expect(entry.verification.references.length).toBeGreaterThan(0);
        }
        for (const url of entry.verification.references) expect(() => new URL(url)).not.toThrow();
      },
    );
  });
});
