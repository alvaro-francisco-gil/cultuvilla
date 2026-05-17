'use client';

import { useState } from 'react';
import { registerToEvent } from '@cultuvilla/shared/services/registrationService';
import type { UserData } from '@cultuvilla/shared/models/user';
import type { PersonData } from '@cultuvilla/shared/models/person';
import { buildDisplayName } from '@cultuvilla/shared/models/person';
import type { EventData } from '@cultuvilla/shared/models/event';
import { X, Phone } from 'lucide-react';
import type { User } from 'firebase/auth';

interface SignUpModalProps {
  event: EventData & { id: string };
  user: User;
  userProfile: (UserData & { id: string }) | null;
  personas: (PersonData & { id: string })[];
  onClose: () => void;
  onSuccess: () => void;
}

export function SignUpModal({
  event,
  user,
  userProfile,
  personas,
  onClose,
  onSuccess,
}: SignUpModalProps) {
  const [selfSelected, setSelfSelected] = useState(true);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const telephoneRequired = event.telephoneRequired;
  const hasTelephone = Boolean(userProfile?.telephone);
  const hasPersonRecord = Boolean(userProfile?.personId);
  const canSignUpSelf = hasPersonRecord && (!telephoneRequired || hasTelephone);

  const togglePersona = (id: string) => {
    setSelectedPersonaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    const inputs = [];

    if (selfSelected && canSignUpSelf && userProfile?.personId) {
      inputs.push({
        userId: user.uid,
        personId: userProfile.personId,
        name: userProfile.displayName ?? user.displayName ?? user.email ?? 'Yo',
      });
    }

    for (const personaId of selectedPersonaIds) {
      const persona = personas.find((p) => p.id === personaId);
      if (persona) {
        inputs.push({ userId: user.uid, personId: personaId, name: buildDisplayName(persona) });
      }
    }

    if (inputs.length === 0) {
      setError('Selecciona al menos un participante.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await registerToEvent(event.id, inputs, event.maxAttendees);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al inscribirse.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl p-6 pb-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Inscribirse al evento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {telephoneRequired && !hasTelephone && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <Phone size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-700">
              Este evento requiere teléfono. Añade tu teléfono en tu perfil para inscribirte.
            </p>
          </div>
        )}

        {!hasPersonRecord && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700">
              No tienes un registro de persona vinculado a tu cuenta. Contacta con un administrador.
            </p>
          </div>
        )}

        <div className="space-y-3 mb-6">
          <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${selfSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} ${!canSignUpSelf ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <input
              type="checkbox"
              checked={selfSelected}
              onChange={(e) => canSignUpSelf && setSelfSelected(e.target.checked)}
              disabled={!canSignUpSelf}
              className="accent-blue-600"
            />
            <div>
              <p className="font-medium text-sm text-gray-900">
                {userProfile?.displayName ?? user.displayName ?? 'Yo'}
              </p>
              <p className="text-xs text-gray-500">Tú</p>
            </div>
          </label>

          {personas.map((persona) => (
            <label
              key={persona.id}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${selectedPersonaIds.has(persona.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
            >
              <input
                type="checkbox"
                checked={selectedPersonaIds.has(persona.id)}
                onChange={() => togglePersona(persona.id)}
                className="accent-blue-600"
              />
              <div>
                <p className="font-medium text-sm text-gray-900">{buildDisplayName(persona)}</p>
                <p className="text-xs text-gray-500">Familiar / acompañante</p>
              </div>
            </label>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {submitting ? 'Inscribiendo...' : 'Confirmar inscripción'}
        </button>
      </div>
    </div>
  );
}
