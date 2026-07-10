import { useEffect, useState } from 'react';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import { getEventsByMunicipality } from '@cultuvilla/shared/services/eventService';
import { getPlaces, getBarrios, getMunicipalities } from '@cultuvilla/shared/services/municipalityService';
import { getNewsPostsByMunicipality } from '@cultuvilla/shared/services/newsService';
import { getFestivalPosters } from '@cultuvilla/shared/services/festivalPosterService';
import type { MentionCandidate } from './mentionText';

/**
 * Load every entity a news `@`-mention can point at — approved organizations
 * (peñas/asociaciones/…), events, places, barrios, the pueblo (villages),
 * festival posters, and other visible news posts. Content entities are filtered
 * to `status: 'active'` (server-side in their services); people are deliberately
 * not mentionable (members have no public profile screen). Loaded once per
 * municipality; a village's directory is small enough to hold in memory and
 * filter client-side as the author types.
 *
 * `excludeNewsId` drops the article being edited from the news candidates so a
 * post can't `@`-mention itself.
 */
export function useMentionSources(
  municipalityId: string | null,
  excludeNewsId?: string,
): {
  candidates: MentionCandidate[];
  loading: boolean;
} {
  const [candidates, setCandidates] = useState<MentionCandidate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!municipalityId) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [orgs, events, places, barrios, villages, posters, news] = await Promise.all([
        getOrganizationsByMunicipality(municipalityId, 'approved').catch(() => []),
        getEventsByMunicipality(municipalityId).catch(() => []),
        getPlaces(municipalityId).catch(() => []),
        getBarrios(municipalityId).catch(() => []),
        getMunicipalities().catch(() => []),
        getFestivalPosters(municipalityId).catch(() => []),
        getNewsPostsByMunicipality(municipalityId, { status: 'active' }).catch(() => []),
      ]);
      if (cancelled) return;
      setCandidates([
        ...orgs.map((o): MentionCandidate => ({ entityType: 'organization', entityId: o.id, label: o.name })),
        ...events.map((e): MentionCandidate => ({ entityType: 'event', entityId: e.id, label: e.title })),
        // getPlaces/getBarrios already filter to active content server-side.
        ...places.map((pl): MentionCandidate => ({ entityType: 'place', entityId: pl.id, label: pl.name })),
        ...barrios.map((b): MentionCandidate => ({ entityType: 'barrio', entityId: b.id, label: b.name })),
        ...villages.map((v): MentionCandidate => ({ entityType: 'village', entityId: v.id, label: v.name })),
        ...posters.map(
          (p): MentionCandidate => ({ entityType: 'festivalPoster', entityId: p.id, label: p.title ?? String(p.year) }),
        ),
        ...news
          .filter((n) => n.id !== excludeNewsId)
          .map((n): MentionCandidate => ({ entityType: 'news', entityId: n.id, label: n.title })),
      ]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [municipalityId, excludeNewsId]);

  return { candidates, loading };
}
