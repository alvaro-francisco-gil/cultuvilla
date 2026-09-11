import { isReservedRootSegment, slugify } from '../../utils/urls';

export interface MunicipalitySlugCandidate {
  id: string;
  name: string;
  province: string;
  codigoINE: string;
  /** An activated village — it wins the bare name over an unactivated twin. */
  communityActive?: boolean;
}

/**
 * Assigns the permanent URL slug of each candidate — `/matabuena`.
 *
 * The bare name wins when it is unique across the candidates, not already taken
 * and not a reserved route word. A shared name gives **every** holder the
 * province suffix (`moya-cuenca`, `moya-las-palmas`) rather than rewarding
 * whoever was seeded first. Docs that share an INE code are one place (a seeded
 * demo village beside its INE doc), not a clash — the activated one takes the
 * bare name. The INE code is the last resort; the dataset never needs it (no
 * name repeats within a province), but it keeps the result total.
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
  const placesByBase = new Map<string, Set<string>>();
  for (const c of candidates) {
    const base = slugify(c.name);
    placesByBase.set(base, (placesByBase.get(base) ?? new Set()).add(c.codigoINE));
  }

  const ordered = [...candidates].sort(
    (a, b) =>
      Number(b.communityActive ?? false) - Number(a.communityActive ?? false) ||
      a.codigoINE.localeCompare(b.codigoINE) ||
      a.id.localeCompare(b.id),
  );
  const result = new Map<string, string>();
  for (const c of ordered) {
    const base = slugify(c.name) || slugify(c.codigoINE);
    const options = [
      ...(placesByBase.get(base)?.size === 1 ? [base] : []),
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
