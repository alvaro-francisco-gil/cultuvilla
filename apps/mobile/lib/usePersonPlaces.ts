import { useEffect, useState } from 'react';
import { getBarrio, getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import type { MunicipalityLink, PersonData } from '@cultuvilla/shared/models/person';

export interface PersonPlaces {
  /** Municipality name the person was born in, or null when unset/unreadable. */
  birthPlace: string | null;
  /** One entry per residence link: "Anaya" or "Anaya · Centro". */
  residences: string[];
}

const EMPTY: PersonPlaces = { birthPlace: null, residences: [] };

/**
 * Resolves a person's `birthPlace` and `municipalityLinks` — which store ids —
 * into display names for the read-only person card.
 *
 * Municipality docs are world-readable, so a missing name means the doc is gone
 * rather than forbidden; the row is simply omitted instead of showing a raw id.
 */
export function usePersonPlaces(person: Pick<PersonData, 'birthPlace' | 'municipalityLinks'> | null) {
  const [places, setPlaces] = useState<PersonPlaces>(EMPTY);

  const birthPlaceId = person?.birthPlace?.municipalityId ?? null;
  // Serialized so the effect doesn't re-run on a new array with equal contents.
  const linksKey = JSON.stringify(person?.municipalityLinks ?? []);

  useEffect(() => {
    let cancelled = false;
    if (!person) {
      setPlaces(EMPTY);
      return;
    }
    const links = JSON.parse(linksKey) as MunicipalityLink[];

    void (async () => {
      const [birth, residences] = await Promise.all([
        birthPlaceId
          ? getMunicipality(birthPlaceId)
              .then((m) => m?.name ?? null)
              .catch(() => null)
          : Promise.resolve(null),
        Promise.all(
          links.map(async (link) => {
            const [municipality, barrio] = await Promise.all([
              getMunicipality(link.municipalityId).catch(() => null),
              link.barrioId
                ? getBarrio(link.municipalityId, link.barrioId).catch(() => null)
                : Promise.resolve(null),
            ]);
            if (!municipality) return null;
            return barrio ? `${municipality.name} · ${barrio.name}` : municipality.name;
          }),
        ),
      ]);
      if (cancelled) return;
      setPlaces({ birthPlace: birth, residences: residences.filter((r): r is string => r !== null) });
    })();

    return () => {
      cancelled = true;
    };
  }, [person, birthPlaceId, linksKey]);

  return places;
}
