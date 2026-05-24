import { GeoPoint } from 'firebase/firestore'
import type { VillageProfileForm } from './CensoTypes'

/**
 * A municipality is the canonical Spanish administrative unit (INE-coded).
 * It is the *physical* place. When a community of users activates Cultuvilla
 * for that municipality, the `community` subfield is populated — at that
 * moment the municipality "becomes" a village in the user-facing sense.
 *
 * 1:1 invariant: there is at most one community per municipality, enforced
 * structurally by storing the community inside the municipality doc.
 */

export interface VillageCommunity {
  description: string
  coverImages: string[]
  adminUserId: string
  profileForm: VillageProfileForm | null
  activatedAt: Date
}

/**
 * Normalize a municipality name for prefix-search: NFD-decompose, strip
 * combining marks, lowercase. "Ávila" → "avila", "Castellón" → "castellon".
 * Used to populate the `nameLower` field on every municipality doc.
 */
export function municipalitySearchKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export interface MunicipalityData {
  // ── Reference data (INE-seeded, immutable in practice) ─────────────────
  name: string
  /** Accent-stripped, lowercased copy of `name` for case/accent-insensitive
   * prefix search. Always derivable from `name`; stored so Firestore can index. */
  nameLower: string
  province: string
  comunidadAutonoma: string
  codigoINE: string
  coordinates: GeoPoint | null
  createdAt: Date

  // ── Escudo (coat of arms, sourced from Wikidata P94 → Cloud Storage) ──
  /** Public URL for the 256×256 WebP. `null` when Wikidata has no escudo for this INE. */
  escudoUrl: string | null
  /** Public URL for the 64×64 WebP thumbnail. */
  escudoThumbUrl: string | null

  // ── Community overlay ─────────────────────────────────────────────────
  community: VillageCommunity | null
  /** Denorm of `community != null` — needed for queries since Firestore
   * can't index "field exists" cheaply. */
  communityActive: boolean
}

export interface MunicipalityDataInput {
  name: string
  province: string
  comunidadAutonoma: string
  codigoINE: string
  coordinates?: GeoPoint | null
  escudoUrl?: string | null
  escudoThumbUrl?: string | null
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
  }
}

export interface ActivateCommunityInput {
  description: string
  coverImages?: string[]
  adminUserId: string
  coordinates?: GeoPoint | null
}

export function buildVillageCommunity(input: ActivateCommunityInput): VillageCommunity {
  return {
    description: input.description,
    coverImages: input.coverImages ?? [],
    adminUserId: input.adminUserId,
    profileForm: null,
    activatedAt: new Date(),
  }
}

// ── Barrios (subcollection: /municipalities/{id}/barrios/{barrioId}) ────

export interface BarrioData {
  name: string
  municipalityId: string
  createdAt: Date
}

export interface BarrioDataInput {
  name: string
  municipalityId: string
}

export function buildBarrioData(input: BarrioDataInput): BarrioData {
  return { ...input, createdAt: new Date() }
}

// ── Cemeteries (subcollection: /municipalities/{id}/cemeteries/{cemId}) ──

export interface CemeteryData {
  name: string
  description: string | null
  municipalityId: string
  createdAt: Date
}

export interface CemeteryDataInput {
  name: string
  municipalityId: string
  description?: string | null
}

export function buildCemeteryData(input: CemeteryDataInput): CemeteryData {
  return {
    name: input.name,
    municipalityId: input.municipalityId,
    description: input.description ?? null,
    createdAt: new Date(),
  }
}
