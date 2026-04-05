'use client';

import { use, useEffect, useState } from 'react';
import { getEvents } from '@villa-events/shared/services/eventService';
import type { EventData } from '@villa-events/shared/models/event';
import { useVillage } from '@/hooks/useVillage';
import { EventCard } from '@/components/event/EventCard';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';

interface VillagePageProps {
  params: Promise<{ id: string }>;
}

export default function VillagePage({ params }: VillagePageProps) {
  const { id: villageId } = use(params);
  const { village, loading: villageLoading } = useVillage();
  const [events, setEvents] = useState<(EventData & { id: string })[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    getEvents(villageId, 'published')
      .then(setEvents)
      .finally(() => setEventsLoading(false));
  }, [villageId]);

  if (villageLoading) {
    return (
      <div className="px-4 py-6 space-y-4">
        <SkeletonLoader className="h-8 w-48" />
        <SkeletonLoader className="h-4 w-32" />
        {[1, 2, 3].map((i) => <SkeletonLoader key={i} className="h-44 rounded-xl" />)}
      </div>
    );
  }

  if (!village) {
    return (
      <div className="px-4 py-6">
        <p className="text-gray-500 text-center py-12">Pueblo no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {village.images[0] && (
        <img src={village.images[0]} alt={village.name} className="w-full h-40 object-cover rounded-xl mb-4" />
      )}
      <h1 className="text-2xl font-bold text-gray-900">{village.name}</h1>
      <p className="text-sm text-gray-500 mt-0.5">{village.provincia}, {village.comunidadAutonoma}</p>
      {village.description && (
        <p className="mt-2 text-sm text-gray-600">{village.description}</p>
      )}

      <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-4">Próximos eventos</h2>

      {eventsLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => <SkeletonLoader key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : events.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No hay eventos publicados.</p>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} villageId={villageId} />
          ))}
        </div>
      )}
    </div>
  );
}
