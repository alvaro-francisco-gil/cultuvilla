import Link from 'next/link';
import { Calendar, MapPin } from 'lucide-react';
import type { EventData } from '@cultuvilla/shared/models/event';

interface FeedCardProps {
  event: EventData & { id: string };
}

export function FeedCard({ event }: FeedCardProps) {
  const dateLabel = event.startDate.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Link
      href={`/event/${event.id}`}
      className="block bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition"
    >
      {event.imageURL ? (
        <img src={event.imageURL} alt={event.title} className="w-full h-40 object-cover" />
      ) : event.municipalityCoverImage ? (
        <img src={event.municipalityCoverImage} alt={event.municipalityName} className="w-full h-40 object-cover opacity-60" />
      ) : (
        <div className="w-full h-40 bg-gray-100" />
      )}
      <div className="p-4">
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
          <MapPin size={12} />
          <span>{event.municipalityName}</span>
        </div>
        <h3 className="text-base font-semibold text-gray-900 line-clamp-1">{event.title}</h3>
        <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
          <Calendar size={12} />
          <span>{dateLabel}</span>
        </div>
      </div>
    </Link>
  );
}
