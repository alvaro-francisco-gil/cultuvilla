'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getOrganization } from '@cultuvilla/shared/services/organizationService';
import { getEventsByOrganization } from '@cultuvilla/shared/services/eventService';
import { isOrgMember } from '@cultuvilla/shared/services/orgMemberService';
import type { OrganizationData } from '@cultuvilla/shared/models/organization';
import type { EventData } from '@cultuvilla/shared/models/event';
import { useAuth } from '@/hooks/useAuth';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';
import { ArrowLeft, Plus, Calendar, MapPin } from 'lucide-react';

const orgTypeLabel: Record<OrganizationData['type'], string> = {
  ayuntamiento: 'Ayuntamiento',
  peña: 'Peña',
  asociación: 'Asociación',
};

const orgStatusColor: Record<OrganizationData['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const orgStatusLabel: Record<OrganizationData['status'], string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

export default function OrgPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuth();

  const [org, setOrg] = useState<(OrganizationData & { id: string }) | null>(null);
  const [events, setEvents] = useState<(EventData & { id: string })[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [o, evts] = await Promise.all([
        getOrganization(orgId),
        getEventsByOrganization(orgId),
      ]);
      setOrg(o);
      setEvents(evts);
      if (user && o) {
        const member = await isOrgMember(orgId, user.uid);
        setIsMember(member);
      }
      setLoading(false);
    }
    load();
  }, [orgId, user]);

  if (loading) {
    return (
      <div className="px-4 py-6 space-y-4">
        <SkeletonLoader className="h-8 w-48" />
        <SkeletonLoader className="h-4 w-32" />
        {[1, 2].map((i) => <SkeletonLoader key={i} className="h-44 rounded-xl" />)}
      </div>
    );
  }

  if (!org) {
    return (
      <div className="px-4 py-6">
        <Link href="/" className="flex items-center gap-1 text-blue-600 text-sm mb-4">
          <ArrowLeft size={16} /> Volver
        </Link>
        <p className="text-gray-500 text-center py-12">Organización no encontrada.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <Link href={`/village/${org.municipalityId}`} className="flex items-center gap-1 text-blue-600 text-sm mb-4">
        <ArrowLeft size={16} /> {org.name}
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${orgStatusColor[org.status]}`}>
            {orgStatusLabel[org.status]}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">{orgTypeLabel[org.type]}</p>
        {org.description && (
          <p className="text-sm text-gray-600 mt-3 whitespace-pre-line">{org.description}</p>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Eventos</h2>
        {isMember && (
          <Link
            href={`/org/${orgId}/events/new`}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
          >
            <Plus size={16} /> Nuevo evento
          </Link>
        )}
      </div>

      {events.length === 0 ? (
        <p className="text-gray-500 text-center py-8 text-sm">No hay eventos de esta organización.</p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const dateLabel = event.startDate.toLocaleDateString('es-ES', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            });
            return (
              <Link
                key={event.id}
                href={`/event/${event.id}`}
                className="block bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
              >
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                  <MapPin size={12} />
                  <span>{event.municipalityName}</span>
                </div>
                <h3 className="text-base font-semibold text-gray-900 line-clamp-1">{event.title}</h3>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                  <Calendar size={12} />
                  <span>{dateLabel}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
