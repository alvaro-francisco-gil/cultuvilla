import { useEffect, useState } from 'react';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import { getEventsByMunicipality } from '@cultuvilla/shared/services/eventService';
import { getPlaces } from '@cultuvilla/shared/services/municipalityService';
import { getVillageMembers } from '@cultuvilla/shared/services/villageMemberService';
import { getUserProfile } from '@cultuvilla/shared/services/userService';
import type { MentionCandidate } from './mentionText';

/**
 * Load every entity in a village that a news `@`-mention can point at —
 * approved organizations (peñas/asociaciones/…), published-or-any events,
 * approved places, and members (resolved to display names). Loaded once per
 * municipality; a village's directory is small enough to hold in memory and
 * filter client-side as the author types.
 */
export function useMentionSources(municipalityId: string | null): {
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
      const [orgs, events, places, members] = await Promise.all([
        getOrganizationsByMunicipality(municipalityId, 'approved').catch(() => []),
        getEventsByMunicipality(municipalityId).catch(() => []),
        getPlaces(municipalityId).catch(() => []),
        getVillageMembers(municipalityId).catch(() => []),
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
      ]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [municipalityId]);

  return { candidates, loading };
}
