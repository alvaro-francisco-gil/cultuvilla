import { useEffect, useState } from 'react';
import { getBarrios, getPlaces } from '@cultuvilla/shared/services/municipalityService';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import { resolveFieldDisplay } from '@cultuvilla/shared/services/censoFieldResolver';
import type { ProfileFormField, OptionsSource } from '@cultuvilla/shared/models/municipality/CensoTypes';
import type { ChoiceOption } from './ChoiceList';

export function useEntityOptions(villageId: string, fields: ProfileFormField[]) {
  const [optionsByField, setOptionsByField] = useState<Record<string, ChoiceOption[]>>({});
  const [loading, setLoading] = useState(false);

  const fieldSources: Array<[string, OptionsSource]> = [];
  const sources = new Set<OptionsSource>();
  for (const f of fields) {
    const src = resolveFieldDisplay(f).optionsSource;
    if (src) {
      sources.add(src);
      fieldSources.push([f.key, src]);
    }
  }
  const sourceKey = [...sources].sort().join(',');

  useEffect(() => {
    if (!villageId || sources.size === 0) {
      setOptionsByField({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [barrios, places, orgs] = await Promise.all([
        sources.has('barrios') ? getBarrios(villageId) : Promise.resolve([]),
        sources.has('places') ? getPlaces(villageId) : Promise.resolve([]),
        sources.has('organizations') ? getOrganizationsByMunicipality(villageId) : Promise.resolve([]),
      ]);
      const bySource: Record<OptionsSource, ChoiceOption[]> = {
        barrios: barrios.map((b) => ({ value: b.id, label: b.name })),
        places: places.map((p) => ({ value: p.id, label: p.name })),
        organizations: orgs.map((o) => ({ value: o.id, label: o.name })),
      };
      const map: Record<string, ChoiceOption[]> = {};
      for (const [key, src] of fieldSources) {
        map[key] = bySource[src];
      }
      if (!cancelled) {
        setOptionsByField(map);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villageId, sourceKey]);

  return { optionsByField, loading };
}
