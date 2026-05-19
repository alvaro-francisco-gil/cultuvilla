'use client';

import { useEffect, useMemo, useState } from 'react';
import { GeoPoint } from '@cultuvilla/shared/firebase';
import { getUpcomingFeed, filterByDistanceKm } from '@cultuvilla/shared/services/feedService';
import { getVillage } from '@cultuvilla/shared/services/villageService';
import type { EventData } from '@cultuvilla/shared/models/event';
import { useAuth } from '@/hooks/useAuth';
import { FeedCard } from '@/components/feed/FeedCard';
import { FeedFilterBar } from '@/components/feed/FeedFilterBar';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';

const NEARBY_RADIUS_KM = 50;

export default function HomePage() {
  const { user, profile, loading: authLoading, profileChecked } = useAuth();
  const [events, setEvents] = useState<(EventData & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [nearbyOn, setNearbyOn] = useState(false);
  const [referencePoint, setReferencePoint] = useState<GeoPoint | null>(null);

  // Resume any pending invite first
  useEffect(() => {
    if (authLoading || !profileChecked) return;
    if (typeof window !== 'undefined') {
      const pending = sessionStorage.getItem('cultuvilla:pendingInvite');
      if (pending) {
        sessionStorage.removeItem('cultuvilla:pendingInvite');
        window.location.replace(pending);
      }
    }
  }, [authLoading, profileChecked]);

  // Resolve reference point for "Cerca de mí"
  useEffect(() => {
    if (!user || !profile?.activeVillageId) return;
    getVillage(profile.activeVillageId).then((v) => {
      if (v?.coordinates) setReferencePoint(v.coordinates);
    });
  }, [user, profile?.activeVillageId]);

  // Load the feed
  useEffect(() => {
    setLoading(true);
    getUpcomingFeed(20)
      .then(({ events }) => setEvents(events))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    if (!nearbyOn || !referencePoint) return events;
    return filterByDistanceKm(events, referencePoint, NEARBY_RADIUS_KM);
  }, [events, nearbyOn, referencePoint]);

  return (
    <div>
      <FeedFilterBar
        nearbyOn={nearbyOn}
        nearbyAvailable={!!referencePoint}
        onToggleNearby={() => setNearbyOn((v) => !v)}
      />
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Próximos eventos</h1>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonLoader key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="text-gray-500 text-sm py-12 text-center">
            {nearbyOn ? 'No hay eventos cerca de ti.' : 'Aún no hay eventos publicados.'}
          </p>
        ) : (
          <div className="space-y-3">
            {visible.map((e) => (
              <FeedCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
