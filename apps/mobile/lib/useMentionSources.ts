import { useEffect, useState } from 'react';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import { getEventsByMunicipality } from '@cultuvilla/shared/services/eventService';
import { getPlaces, getMunicipalities } from '@cultuvilla/shared/services/municipalityService';
import { getNewsPostsByMunicipality } from '@cultuvilla/shared/services/newsService';
import { getVillageMembers } from '@cultuvilla/shared/services/villageMemberService';
import { getUserProfile } from '@cultuvilla/shared/services/userService';
import type { MentionCandidate } from './mentionText';

/**
 * Load every entity a news `@`-mention can point at — approved organizations
 * (peñas/asociaciones/…), events, approved places, members (resolved to display
 * names), villages, and other approved news posts. Loaded once per municipality;
 * a village's directory is small enough to hold in memory and filter
 * client-side as the author types.
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
      const [orgs, events, places, members, villages, news] = await Promise.all([
        getOrganizationsByMunicipality(municipalityId, 'approved').catch(() => []),
        getEventsByMunicipality(municipalityId).catch(() => []),
        getPlaces(municipalityId).catch(() => []),
        getVillageMembers(municipalityId).catch(() => []),
        getMunicipalities().catch(() => []),
        getNewsPostsByMunicipality(municipalityId, { status: 'approved' }).catch(() => []),
      ]);
      const memberCandidates = await Promise.all(
        members.map(async (m): Promise<MentionCandidate> => {
          const profile = await getUserProfile(m.userId).catch(() => null);
          return { entityType: 'user', entityId: m.userId, label: profile?.displayName ?? m.userId };
        }),
      );
      if (cancelled) return;
      setCandidates([
        ...orgs.map((o): MentionCandidate => ({ entityType: 'organization', entityId: o.id, label: o.name })),
        ...events.map((e): MentionCandidate => ({ entityType: 'event', entityId: e.id, label: e.title })),
        ...places
          .filter((pl) => pl.status === 'approved')
          .map((pl): MentionCandidate => ({ entityType: 'place', entityId: pl.id, label: pl.name })),
        ...memberCandidates,
        ...villages.map((v): MentionCandidate => ({ entityType: 'village', entityId: v.id, label: v.name })),
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
