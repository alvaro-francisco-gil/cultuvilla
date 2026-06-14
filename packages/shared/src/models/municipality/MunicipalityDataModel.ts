import { z } from 'zod';
import { LatLngSchema, type LatLng } from '../core/LocationDataModel';
import { VillageProfileFormSchema } from './CensoTypes';

/**
 * A municipality is the canonical Spanish administrative unit (INE-coded).
 * It is the *physical* place. When a community of users activates Cultuvilla
 * for that municipality, the `community` subfield is populated — at that
 * moment the municipality "becomes" a village in the user-facing sense.
 *
 * 1:1 invariant: there is at most one community per municipality, enforced
 * structurally by storing the community inside the municipality doc.
 */

export const VillageCommunitySchema = z.object({
  description: z.string(),
  coverImages: z.array(z.string()),
  adminUserId: z.string(),
  profileForm: VillageProfileFormSchema.nullable(),
  activatedAt: z.date(),
});
export type VillageCommunity = z.infer<typeof VillageCommunitySchema>;

/**
 * Normalize a municipality name for prefix-search: NFD-decompose, strip
 * combining marks, lowercase. "Ávila" → "avila", "Castellón" → "castellon".
 * Used to populate the `nameLower` field on every municipality doc.
 */
export function municipalitySearchKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export const MunicipalityDataSchema = z.object({
  // ── Reference data (INE-seeded, immutable in practice) ─────────────────
  name: z.string(),
  /** Accent-stripped, lowercased copy of `name` for case/accent-insensitive
   * prefix search. Always derivable from `name`; stored so Firestore can index. */
  nameLower: z.string(),
  province: z.string(),
  comunidadAutonoma: z.string(),
  codigoINE: z.string(),
  coordinates: LatLngSchema.nullable(),
  createdAt: z.date(),

  // ── Escudo (coat of arms, sourced from Wikidata P94 → Cloud Storage) ──
  /** Public URL for the 256×256 WebP. `null` when Wikidata has no escudo for this INE. */
  escudoUrl: z.string().nullable(),
  /** Public URL for the 64×64 WebP thumbnail. */
  escudoThumbUrl: z.string().nullable(),

  // ── Community overlay ─────────────────────────────────────────────────
  community: VillageCommunitySchema.nullable(),
  /** Denorm of `community != null` — needed for queries since Firestore
   * can't index "field exists" cheaply. */
  communityActive: z.boolean(),
});
export type MunicipalityData = z.infer<typeof MunicipalityDataSchema>;

export interface MunicipalityDataInput {
  name: string;
  province: string;
  comunidadAutonoma: string;
  codigoINE: string;
  coordinates?: LatLng | null;
  escudoUrl?: string | null;
  escudoThumbUrl?: string | null;
}

export function buildMunicipalityData(input: MunicipalityDataInput): MunicipalityData {
  return {
    name: input.name,
    nameLower: municipalitySearchKey(input.name),
    province: input.province,
    comunidadAutonoma: input.comunidadAutonoma,
    codigoINE: input.codigoINE,
    coordinates: input.coordinates ?? null,
    createdAt: new Date(),
    escudoUrl: input.escudoUrl ?? null,
    escudoThumbUrl: input.escudoThumbUrl ?? null,
    community: null,
    communityActive: false,
  };
}

export interface ActivateCommunityInput {
  description: string;
  coverImages?: string[];
  adminUserId: string;
  coordinates?: LatLng | null;
}

export function buildVillageCommunity(input: ActivateCommunityInput): VillageCommunity {
  return {
    description: input.description,
    coverImages: input.coverImages ?? [],
    adminUserId: input.adminUserId,
    profileForm: null,
    activatedAt: new Date(),
  };
}

// ── Barrios (subcollection: /municipalities/{id}/barrios/{barrioId}) ────

export const BarrioDataSchema = z.object({
  name: z.string(),
  municipalityId: z.string(),
  /** Public download URL for the barrio's picture. `null` when unset. */
  imageURL: z.string().nullable(),
  createdAt: z.date(),
});
export type BarrioData = z.infer<typeof BarrioDataSchema>;

export interface BarrioDataInput {
  name: string;
  municipalityId: string;
  imageURL?: string | null;
}

export function buildBarrioData(input: BarrioDataInput): BarrioData {
  return {
    name: input.name,
    municipalityId: input.municipalityId,
    imageURL: input.imageURL ?? null,
    createdAt: new Date(),
  };
}

// ── Places (subcollection: /municipalities/{id}/places/{placeId}) ────────
//
// Notable places within a municipality (cemeteries, churches, etc.),
// discriminated by `kind`. `cemetery` is load-bearing: it is the target of
// Person.burialPlace (see PersonDataModel.BurialPlaceSchema). Barrios remain a
// separate concept — they are administrative subdivisions, not physical sites.

export const PlaceKindSchema = z.enum([
  'cemetery',
  'church', // iglesia — parish church in the village
  'hermitage', // ermita — standalone chapel/shrine, often on the outskirts
  'plaza', // plaza — main square (an open area, not a building)
  'town_hall', // ayuntamiento — civic seat
]);
export type PlaceKind = z.infer<typeof PlaceKindSchema>;

export const PlaceDataSchema = z.object({
  name: z.string(),
  kind: PlaceKindSchema,
  description: z.string().nullable(),
  municipalityId: z.string(),
  /** Public download URL for the place's picture. `null` when unset. */
  imageURL: z.string().nullable(),
  createdAt: z.date(),
});
export type PlaceData = z.infer<typeof PlaceDataSchema>;

export interface PlaceDataInput {
  name: string;
  kind: PlaceKind;
  municipalityId: string;
  description?: string | null;
  imageURL?: string | null;
}

export function buildPlaceData(input: PlaceDataInput): PlaceData {
  return {
    name: input.name,
    kind: input.kind,
    municipalityId: input.municipalityId,
    description: input.description ?? null,
    imageURL: input.imageURL ?? null,
    createdAt: new Date(),
  };
}
