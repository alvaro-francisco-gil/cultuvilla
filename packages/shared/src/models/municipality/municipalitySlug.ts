import { isReservedRootSegment, slugify } from '../../utils/urls';

export interface MunicipalitySlugCandidate {
  id: string;
  name: string;
  province: string;
  codigoINE: string;
}

/**
 * Assigns the permanent URL slug of each candidate — `/matabuena`.
 *
 * The bare name wins when it is unique across the candidates, not already taken
 * and not a reserved route word. A shared name gives **every** holder the
 * province suffix (`moya-cuenca`, `moya-las-palmas`) rather than rewarding
 * whoever was seeded first. The INE code is the last resort; the dataset never
 * needs it (no name repeats within a province), but it keeps the result total.
 *
 * `taken` is the slugs already assigned — they never move, so a later
 * municipality can only take a slug that is still free. Deterministic: the same
 * input always yields the same slugs.
 */
export function assignMunicipalitySlugs(
  candidates: readonly MunicipalitySlugCandidate[],
  taken: Iterable<string> = [],
): Map<string, string> {
  const used = new Set(taken);
  const baseCount = new Map<string, number>();
  for (const c of candidates) {
    const base = slugify(c.name);
    baseCount.set(base, (baseCount.get(base) ?? 0) + 1);
  }

  const ordered = [...candidates].sort((a, b) => a.codigoINE.localeCompare(b.codigoINE));
  const result = new Map<string, string>();
  for (const c of ordered) {
    const base = slugify(c.name) || slugify(c.codigoINE);
    const options = [
      ...((baseCount.get(base) ?? 0) === 1 ? [base] : []),
      `${base}-${slugify(c.province)}`,
      `${base}-${slugify(c.codigoINE)}`,
    ];
    const slug = options.find((s) => !used.has(s) && !isReservedRootSegment(s));
    if (!slug) {
      throw new Error(`assignMunicipalitySlugs: no free slug for ${c.id} (${c.name})`);
    }
    used.add(slug);
    result.set(c.id, slug);
  }
  return result;
}
