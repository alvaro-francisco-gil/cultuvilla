import { z } from 'zod';
import { BarrioKindSchema, type BarrioKind } from './MunicipalityDataModel';

/**
 * The settlements OSM knows about inside one municipality, stored server-side so
 * `startVillage` can seed a newly activated village with its own pedanías,
 * aldeas, parroquias and barrios.
 *
 * Lives at `_admin/settlements/seeds/{codigoINE}` — one document per
 * municipality, keyed by INE code. Three reasons for that path:
 *
 * 1. `_admin/**` is already `allow read, write: if false` for every client, and
 *    the Admin SDK bypasses rules. This is reference data no client reads, so it
 *    needs no rules of its own and cannot be tampered with.
 * 2. Keyed lookup: activation reads exactly one document, never a query.
 * 3. The whole dataset is ~8.2MB across 8,167 municipalities — far too big to
 *    bundle into the Cloud Functions deploy, where it would ride along in every
 *    function's package.
 *
 * (`_admin` paths need an EVEN number of segments to be a document;
 * `_admin/settlements/seeds/{id}` is four.)
 */
export const SettlementSeedEntrySchema = z.object({
  name: z.string(),
  kind: BarrioKindSchema,
  /** The municipal seat. Exactly one entry per municipality carries this — and
   *  it is frequently not the municipality's own name (Aramaio's is Ibarra). */
  isSeat: z.boolean(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});
export type SettlementSeedEntry = z.infer<typeof SettlementSeedEntrySchema>;

export const SettlementSeedSchema = z.object({
  codigoINE: z.string(),
  name: z.string(),
  settlements: z.array(SettlementSeedEntrySchema),
});
export type SettlementSeedData = z.infer<typeof SettlementSeedSchema>;

/**
 * Deterministic document id for a seeded barrio.
 *
 * Activation must be idempotent: a village that is somehow activated twice, or
 * a seed re-run after new OSM data lands, must not end up with two rows for the
 * same place. Deriving the id from kind + normalized name makes the second write
 * an overwrite of the first rather than a duplicate.
 *
 * `kind` is part of the key because a municipality legitimately has a barrio and
 * a pedanía of the same name (a neighbourhood named after the outlying village
 * it faces), and those are two different rows.
 */
export function settlementSeedId(kind: BarrioKind, name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    // Firestore ids cap at 1500 bytes; nothing here is close, but an unbounded
    // slug from arbitrary input is a footgun.
    .slice(0, 100);
  // A name of only punctuation would slug to empty and collide with every other
  // such name, so fall back to a stable hash of the original.
  const safe = slug.length > 0 ? slug : `x${hashName(name)}`;
  return `osm-${kind}-${safe}`;
}

function hashName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
