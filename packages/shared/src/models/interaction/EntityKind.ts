import { z } from 'zod';

/**
 * The village-scoped things that support comments.
 *
 * This is *comment-capable kinds*, not the entity family from AGENTS.md —
 * `vocabularyTerm` is on the list but is deliberately NOT an entity: it has no
 * hero-image detail screen and no card scroll. `REPORT_TARGET_KINDS` widens the
 * same list further with `comment` and `person`.
 */
export const ENTITY_KINDS = [
  'event',
  'festivalPoster',
  'place',
  'barrio',
  'organization',
  'news',
  'vocabularyTerm',
  'historyEntry',
] as const;

export const EntityKindSchema = z.enum(ENTITY_KINDS);
export type EntityKind = z.infer<typeof EntityKindSchema>;
