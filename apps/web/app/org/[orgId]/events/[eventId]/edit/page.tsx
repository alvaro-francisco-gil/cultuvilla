'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getEvent, updateEvent, updateEventStatus } from '@cultuvilla/shared/services/eventService';
import type { EventData } from '@cultuvilla/shared/models/event';
import { EventForm, type EventFormData } from '@/components/event/EventForm';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';
import { ArrowLeft } from 'lucide-react';

interface EditEventPageProps {
  params: Promise<{ orgId: string; eventId: string }>;
}

export default function EditEventPage({ params }: EditEventPageProps) {
  const { orgId, eventId } = use(params);
  const router = useRouter();

  const [event, setEvent] = useState<(EventData & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    getEvent(eventId)
      .then(setEvent)
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleSubmit = async (data: EventFormData) => {
    await updateEvent(eventId, data);
    router.push(`/org/${orgId}`);
  };

  const handlePublish = async () => {
    setActionLoading(true);
    try {
      await updateEventStatus(eventId, 'published');
      router.push(`/event/${eventId}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('¿Cancelar este evento?')) return;
    setActionLoading(true);
    try {
      await updateEventStatus(eventId, 'cancelled');
      router.push(`/org/${orgId}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-6 space-y-4">
        <SkeletonLoader className="h-8 w-48" />
        <SkeletonLoader className="h-12" />
        <SkeletonLoader className="h-32" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="px-4 py-6">
        <Link href={`/org/${orgId}`} className="flex items-center gap-1 text-blue-600 text-sm mb-4">
          <ArrowLeft size={16} /> Volver
        </Link>
        <p className="text-gray-500 text-center py-12">Evento no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <Link href={`/org/${orgId}`} className="flex items-center gap-1 text-blue-600 text-sm mb-4">
        <ArrowLeft size={16} /> Volver a la organización
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar evento</h1>

      <EventForm
        initial={event}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        submitLabel="Guardar cambios"
        extraActions={
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            {event.status !== 'published' && (
              <button
                type="button"
                onClick={handlePublish}
                disabled={actionLoading}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                {actionLoading ? 'Procesando...' : 'Publicar'}
              </button>
            )}
            {event.status !== 'cancelled' && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={actionLoading}
                className="flex-1 border border-red-300 text-red-600 py-3 rounded-xl text-sm font-medium hover:bg-red-50 transition disabled:opacity-50"
              >
                {actionLoading ? 'Procesando...' : 'Cancelar evento'}
              </button>
            )}
          </div>
        }
      />
    </div>
  );
}
