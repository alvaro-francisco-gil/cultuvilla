'use client';

import type { RegistrationData } from '@cultuvilla/shared/models/event';
import { Users, Clock } from 'lucide-react';

interface AttendeeListProps {
  registrations: (RegistrationData & { id: string })[];
  confirmedCount: number;
  isMember: boolean;
}

export function AttendeeList({ registrations, confirmedCount, isMember }: AttendeeListProps) {
  if (!isMember) {
    return (
      <div className="flex items-center gap-2 text-gray-600 text-sm">
        <Users size={16} />
        <span>{confirmedCount} {confirmedCount === 1 ? 'asistente confirmado' : 'asistentes confirmados'}</span>
      </div>
    );
  }

  const confirmed = registrations.filter((r) => r.status === 'confirmed');
  const waitlisted = registrations.filter((r) => r.status === 'waitlisted');

  return (
    <div>
      {confirmed.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Users size={14} />
            Confirmados ({confirmed.length})
          </h3>
          <ul className="space-y-1">
            {confirmed.map((reg) => (
              <li key={reg.id} className="text-sm text-gray-800 px-3 py-1.5 bg-green-50 rounded-lg">
                {reg.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {waitlisted.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Clock size={14} />
            Lista de espera ({waitlisted.length})
          </h3>
          <ul className="space-y-1">
            {waitlisted.map((reg) => (
              <li key={reg.id} className="text-sm text-gray-600 px-3 py-1.5 bg-gray-50 rounded-lg">
                {reg.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {registrations.length === 0 && (
        <p className="text-sm text-gray-500">Nadie inscrito todavía.</p>
      )}
    </div>
  );
}
