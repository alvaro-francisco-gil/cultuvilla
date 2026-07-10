import { z } from 'zod';

/** The six village-scoped entities that support comments + reactions. */
export const ENTITY_KINDS = [
  'event',
  'festivalPoster',
  'place',
  'barrio',
  'organization',
  'news',
] as const;

export const EntityKindSchema = z.enum(ENTITY_KINDS);
export type EntityKind = z.infer<typeof EntityKindSchema>;
