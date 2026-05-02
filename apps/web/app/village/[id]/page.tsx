'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getVillage } from '@villa-events/shared/services/villageService';
import { getEventsByVillage } from '@villa-events/shared/services/eventService';
import { getOrganizationsByVillage } from '@villa-events/shared/services/organizationService';
import { isVillageMember } from '@villa-events/shared/services/villageMemberService';
import type { VillageData } from '@villa-events/shared/models/village';
import type { EventData } from '@villa-events/shared/models/event';
import type { OrganizationData } from '@villa-events/shared/models/organization';
import { useAuth } from '@/hooks/useAuth';
import { FeedCard } from '@/components/feed/FeedCard';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';

export default function VillagePage() {
  const params = useParams<{ id: string }>();
  const villageId = params.id;
  const { user } = useAuth();

  const [village, setVillage] = useState<(VillageData & { id: string }) | null>(null);
  const [events, setEvents] = useState<(EventData & { id: string })[]>([]);
  const [orgs, setOrgs] = useState<(OrganizationData & { id: string })[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!villageId) return;
    Promise.all([
      getVillage(villageId),
      getEventsByVillage(villageId, 'published'),
      getOrganizationsByVillage(villageId, 'approved'),
      user ? isVillageMember(villageId, user.uid) : Promise.resolve(false),
    ])
      .then(([v, evs, os, mem]) => {
        setVillage(v);
        setEvents(evs);
        setOrgs(os);
        setIsMember(mem);
      })
      .finally(() => setLoading(false));
  }, [villageId, user]);

  if (loading) {
    return (
      <div className="px-4 py-6 space-y-4">
        <SkeletonLoader className="h-40 rounded-xl" />
        <SkeletonLoader className="h-6 w-40" />
        <SkeletonLoader className="h-20 rounded-xl" />
      </div>
    );
  }

  if (!village) {
    return <p className="px-4 py-6 text-gray-500">Pueblo no encontrado.</p>;
  }

  const cover = village.images?.[0] ?? null;

  return (
    <div className="pb-12">
      {cover ? (
        <img src={cover} alt={village.name} className="w-full h-44 object-cover" />
      ) : (
        <div className="w-full h-44 bg-gray-100" />
      )}

      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900">{village.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{village.provincia}</p>
        {village.description && <p className="text-sm text-gray-700 mt-3">{village.description}</p>}

        {!isMember && user && (
          <div className="mt-4 p-3 rounded-lg bg-blue-50 text-blue-800 text-sm">
            Eres visitante. Pídele a un coordinador un enlace de invitación para hacerte vecino.
          </div>
        )}

        <h2 className="text-sm font-semibold text-gray-700 mt-8 mb-3">Próximos eventos</h2>
        {events.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay eventos próximos en {village.name}.</p>
        ) : (
          <div className="space-y-3">
            {events.map((e) => <FeedCard key={e.id} event={e} />)}
          </div>
        )}

        <h2 className="text-sm font-semibold text-gray-700 mt-8 mb-3">Asociaciones y peñas</h2>
        {orgs.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay organizaciones aprobadas todavía.</p>
        ) : (
          <ul className="space-y-2">
            {orgs.map((o) => (
              <li key={o.id}>
                <Link href={`/org/${o.id}`} className="text-sm text-blue-700 hover:underline">
                  {o.name}
                </Link>
                <span className="text-xs text-gray-400 ml-2">{o.type}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
