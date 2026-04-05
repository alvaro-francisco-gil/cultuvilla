'use client';

import Link from 'next/link';
import type { EventData } from '@villa-events/shared/models/event';
import { Calendar, MapPin, Users, Tag } from 'lucide-react';

interface EventCardProps {
  event: EventData & { id: string };
  villageId: string;
}

function statusLabel(status: EventData['status']): string {
  switch (status) {
    case 'published': return 'Publicado';
    case 'draft': return 'Borrador';
    case 'cancelled': return 'Cancelado';
    case 'completed': return 'Completado';
  }
}

function statusColor(status: EventData['status']): string {
  switch (status) {
    case 'published': return 'bg-green-100 text-green-700';
    case 'draft': return 'bg-gray-100 text-gray-600';
    case 'cancelled': return 'bg-red-100 text-red-700';
    case 'completed': return 'bg-blue-100 text-blue-700';
  }
}

export function EventCard({ event, villageId }: EventCardProps) {
  const formattedDate = event.startDate.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const locationText = event.location.text ?? 'Ubicación por definir';

  return (
    <Link
      href={`/village/${villageId}/event/${event.id}`}
      className="block rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition overflow-hidden"
    >
      {event.imageURL && (
        <img src={event.imageURL} alt={event.title} className="w-full h-36 object-cover" />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900 leading-snug">{event.title}</h2>
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(event.status)}`}>
            {statusLabel(event.status)}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{event.organizationName}</p>

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Calendar size={13} className="shrink-0" />
            <span className="capitalize">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <MapPin size={13} className="shrink-0" />
            <span className="line-clamp-1">{locationText}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          {event.maxAttendees !== null && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Users size={12} />
              <span>Máx. {event.maxAttendees}</span>
            </div>
          )}
          {event.price !== null ? (
            <div className="flex items-center gap-1 text-xs font-medium text-blue-600">
              <Tag size={12} />
              <span>{event.price === 0 ? 'Gratis' : `${event.price} €`}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs font-medium text-green-600">
              <Tag size={12} />
              <span>Gratis</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
