'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getUserRegistrationsAcrossEvents } from '@cultuvilla/shared/services/registrationService';
import type { RegistrationData } from '@cultuvilla/shared/models/event';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';
import { CalendarCheck, Clock } from 'lucide-react';

interface RegistrationWithPath extends RegistrationData {
  id: string;
  eventPath: string;
}

function parseEventPath(eventPath: string): { eventId: string } | null {
  // path: events/{eventId}
  const parts = eventPath.split('/');
  if (parts.length !== 2) return null;
  return { eventId: parts[1] };
}

export default function MySignUpsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [registrations, setRegistrations] = useState<RegistrationWithPath[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    getUserRegistrationsAcrossEvents(user.uid)
      .then(setRegistrations)
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="px-4 py-6 space-y-4">
        <SkeletonLoader className="h-8 w-40" />
        {[1, 2, 3].map((i) => <SkeletonLoader key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mis inscripciones</h1>

      {registrations.length === 0 ? (
        <div className="text-center py-16">
          <CalendarCheck size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No tienes inscripciones todavía.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {registrations.map((reg) => {
            const parsed = parseEventPath(reg.eventPath);
            const href = parsed
              ? `/event/${parsed.eventId}`
              : '#';

            return (
              <Link
                key={reg.id}
                href={href}
                className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
              >
                <div className={`mt-0.5 shrink-0 p-2 rounded-full ${reg.status === 'confirmed' ? 'bg-green-100' : 'bg-amber-100'}`}>
                  {reg.status === 'confirmed' ? (
                    <CalendarCheck size={16} className="text-green-600" />
                  ) : (
                    <Clock size={16} className="text-amber-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-1">{reg.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {reg.status === 'confirmed' ? 'Confirmado' : `Lista de espera · posición ${reg.position}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {reg.registeredAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${reg.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {reg.status === 'confirmed' ? 'Confirmado' : 'Espera'}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
