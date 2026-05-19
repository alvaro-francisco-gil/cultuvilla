'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { getEventsByMunicipality } from '@cultuvilla/shared/services/eventService';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import { isVillageMember, getVillageMember } from '@cultuvilla/shared/services/villageMemberService';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality';
import type { EventData } from '@cultuvilla/shared/models/event';
import type { OrganizationData } from '@cultuvilla/shared/models/organization';
import { useAuth } from '@/hooks/useAuth';
import { FeedCard } from '@/components/feed/FeedCard';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';

export default function VillagePage() {
  const params = useParams<{ id: string }>();
  const municipalityId = params.id;
  const { user } = useAuth();

  const [municipality, setMunicipality] = useState<(MunicipalityData & { id: string }) | null>(null);
  const [events, setEvents] = useState<(EventData & { id: string })[]>([]);
  const [orgs, setOrgs] = useState<(OrganizationData & { id: string })[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [memberDoc, setMemberDoc] = useState<{ profileCompletedAt: Date | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!municipalityId) return;
    Promise.all([
      getMunicipality(municipalityId),
      getEventsByMunicipality(municipalityId, 'published'),
      getOrganizationsByMunicipality(municipalityId, 'approved'),
      user ? isVillageMember(municipalityId, user.uid) : Promise.resolve(false),
      user ? getVillageMember(municipalityId, user.uid) : Promise.resolve(null),
    ])
      .then(([v, evs, os, mem, mDoc]) => {
        setMunicipality(v);
        setEvents(evs);
        setOrgs(os);
        setIsMember(mem as boolean);
        setMemberDoc(mDoc ? { profileCompletedAt: (mDoc as { profileCompletedAt: Date | null }).profileCompletedAt } : null);
      })
      .finally(() => setLoading(false));
  }, [municipalityId, user]);

  if (loading) {
    return (
      <div className="px-4 py-6 space-y-4">
        <SkeletonLoader className="h-40 rounded-xl" />
        <SkeletonLoader className="h-6 w-40" />
        <SkeletonLoader className="h-20 rounded-xl" />
      </div>
    );
  }

  if (!municipality) {
    return <p className="px-4 py-6 text-gray-500">Pueblo no encontrado.</p>;
  }

  const community = municipality.community;
  const cover = community?.coverImages[0] ?? null;

  return (
    <div className="pb-12">
      {cover ? (
        <img src={cover} alt={municipality.name} className="w-full h-44 object-cover" />
      ) : (
        <div className="w-full h-44 bg-gray-100" />
      )}

      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900">{municipality.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{municipality.province}</p>
        {community?.description && <p className="text-sm text-gray-700 mt-3">{community.description}</p>}

        {!isMember && user && (
          <div className="mt-4 p-3 rounded-lg bg-blue-50 text-blue-800 text-sm">
            Eres visitante. Pídele a un coordinador un enlace de invitación para hacerte vecino.
          </div>
        )}

        {isMember && memberDoc && !memberDoc.profileCompletedAt && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm">
            Aún no has completado el censo de {municipality.name}.{' '}
            <Link href={`/village/${municipality.id}/censo`} className="underline font-medium">
              Completar ahora
            </Link>
          </div>
        )}

        <h2 className="text-sm font-semibold text-gray-700 mt-8 mb-3">Próximos eventos</h2>
        {events.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay eventos próximos en {municipality.name}.</p>
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
