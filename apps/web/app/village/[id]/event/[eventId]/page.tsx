'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getEvent } from '@villa-events/shared/services/eventService';
import { cancelRegistration } from '@villa-events/shared/services/registrationService';
import { getUserProfile } from '@villa-events/shared/services/userService';
import type { EventData } from '@villa-events/shared/models/event';
import type { UserData } from '@villa-events/shared/models/user';
import { useVillage } from '@/hooks/useVillage';
import { useAuth } from '@/hooks/useAuth';
import { useRegistrations } from '@/hooks/useRegistrations';
import { usePersonas } from '@/hooks/usePersonas';
import { SignUpModal } from '@/components/event/SignUpModal';
import { AttendeeList } from '@/components/event/AttendeeList';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';
import { ArrowLeft, Calendar, MapPin, Tag, Phone, Users } from 'lucide-react';

interface EventPageProps {
  params: Promise<{ id: string; eventId: string }>;
}

export default function EventDetailPage({ params }: EventPageProps) {
  const { id: villageId, eventId } = use(params);
  const { user } = useAuth();
  const { isMember } = useVillage();

  const [event, setEvent] = useState<(EventData & { id: string }) | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<(UserData & { id: string }) | null>(null);
  const [showSignUpModal, setShowSignUpModal] = useState(false);

  const { allRegistrations, myRegistrations, confirmedCount, loading: regsLoading, reload: reloadRegs } = useRegistrations(villageId, eventId);
  const { personas } = usePersonas();

  useEffect(() => {
    getEvent(villageId, eventId)
      .then(setEvent)
      .finally(() => setEventLoading(false));
  }, [villageId, eventId]);

  useEffect(() => {
    if (user) {
      getUserProfile(user.uid).then(setUserProfile);
    }
  }, [user]);

  const handleCancel = async (regId: string) => {
    if (!confirm('¿Cancelar esta inscripción?')) return;
    await cancelRegistration(villageId, eventId, regId);
    reloadRegs();
  };

  if (eventLoading) {
    return (
      <div className="px-4 py-6 space-y-4">
        <SkeletonLoader className="h-48 rounded-xl" />
        <SkeletonLoader className="h-8 w-3/4" />
        <SkeletonLoader className="h-4 w-1/2" />
        <SkeletonLoader className="h-20" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="px-4 py-6">
        <Link href={`/village/${villageId}`} className="flex items-center gap-1 text-blue-600 text-sm mb-4">
          <ArrowLeft size={16} /> Volver
        </Link>
        <p className="text-gray-500 text-center py-12">Evento no encontrado.</p>
      </div>
    );
  }

  const isFull = event.maxAttendees !== null && confirmedCount >= event.maxAttendees;
  const isOpen = event.status === 'published';

  const formattedStart = event.startDate.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const formattedEnd = event.endDate
    ? event.endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="pb-6">
      <div className="px-4 pt-4 mb-2">
        <Link href={`/village/${villageId}`} className="flex items-center gap-1 text-blue-600 text-sm">
          <ArrowLeft size={16} /> Volver al pueblo
        </Link>
      </div>

      {event.imageURL && (
        <img src={event.imageURL} alt={event.title} className="w-full h-48 object-cover" />
      )}

      <div className="px-4 pt-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{event.organizationName}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <Calendar size={15} className="mt-0.5 shrink-0" />
            <div>
              <span className="capitalize">{formattedStart}</span>
              {formattedEnd && <span className="block text-xs text-gray-500">hasta {formattedEnd}</span>}
            </div>
          </div>

          {(event.location.text || event.location.coordinates) && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <MapPin size={15} className="shrink-0" />
              <span>{event.location.text ?? 'Ver mapa'}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Tag size={15} className="shrink-0" />
            <span>{event.price === null || event.price === 0 ? 'Gratis' : `${event.price} €`}</span>
          </div>

          {event.maxAttendees !== null && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Users size={15} className="shrink-0" />
              <span>{confirmedCount} / {event.maxAttendees} plazas ocupadas</span>
            </div>
          )}

          {event.telephoneRequired && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <Phone size={15} className="shrink-0" />
              <span>Requiere teléfono de contacto</span>
            </div>
          )}
        </div>

        {event.description && (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{event.description}</p>
        )}

        {/* Sign up button */}
        {isOpen && user && (
          <div className="space-y-2">
            <button
              onClick={() => setShowSignUpModal(true)}
              disabled={isFull}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isFull ? 'Evento completo' : 'Inscribirse'}
            </button>
          </div>
        )}

        {!user && isOpen && (
          <Link href="/login" className="block w-full text-center bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition">
            Inicia sesión para inscribirte
          </Link>
        )}

        {/* My registrations */}
        {myRegistrations.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Mis inscripciones</h2>
            <ul className="space-y-2">
              {myRegistrations.map((reg) => (
                <li key={reg.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{reg.name}</p>
                    <p className="text-xs text-gray-500">
                      {reg.status === 'confirmed' ? 'Confirmado' : 'En lista de espera'} · posición {reg.position}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCancel(reg.id)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Cancelar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Attendee list */}
        {!regsLoading && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Asistentes</h2>
            <AttendeeList
              registrations={allRegistrations}
              confirmedCount={confirmedCount}
              isMember={isMember}
            />
          </div>
        )}
      </div>

      {showSignUpModal && user && (
        <SignUpModal
          event={event}
          villageId={villageId}
          user={user}
          userProfile={userProfile}
          personas={personas}
          onClose={() => setShowSignUpModal(false)}
          onSuccess={() => {
            setShowSignUpModal(false);
            reloadRegs();
          }}
        />
      )}
    </div>
  );
}
