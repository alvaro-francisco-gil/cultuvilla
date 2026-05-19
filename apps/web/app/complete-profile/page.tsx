'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createUserProfile } from '@cultuvilla/shared/services/userService';
import { acceptInvite } from '@cultuvilla/shared/services/inviteTokenService';

const PENDING_INVITE_KEY = 'cultuvilla:pendingInvite';

interface PendingInvite {
  municipalityId: string;
  tokenId: string;
}

function readPendingInvite(): PendingInvite | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(PENDING_INVITE_KEY);
  if (!raw) return null;
  try {
    // Stored format: "/invite/{tokenId}?v={municipalityId}"
    const m = raw.match(/^\/invite\/([^?]+)\?v=(.+)$/);
    if (!m) return null;
    return { tokenId: decodeURIComponent(m[1]), municipalityId: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

export default function CompleteProfilePage() {
  const { user, profile, loading, profileLoading, refreshProfile } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (profile) {
      router.replace('/');
      return;
    }
    if (user.displayName) setDisplayName(user.displayName);
    setPendingInvite(readPendingInvite());
  }, [user, profile, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setSubmitting(true);
    try {
      if (!displayName.trim()) throw new Error('El nombre es obligatorio');
      if (!birthday) throw new Error('La fecha de nacimiento es obligatoria');

      const profileData = {
        displayName: displayName.trim(),
        email: user.email ?? '',
        birthday: new Date(birthday),
        photoURL: user.photoURL ?? null,
      };

      if (pendingInvite) {
        const result = await acceptInvite(
          pendingInvite.municipalityId,
          pendingInvite.tokenId,
          profileData,
        );
        sessionStorage.removeItem(PENDING_INVITE_KEY);
        await refreshProfile();
        router.replace(`/village/${result.municipalityId}`);
        return;
      }

      await createUserProfile(user.uid, profileData);
      await refreshProfile();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear perfil');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Completa tu perfil</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pendingInvite ? 'Termina el registro para unirte al pueblo' : 'Solo nos faltan unos datos'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Nombre completo"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div>
            <label className="block text-xs text-gray-500 mb-1 ml-1">Fecha de nacimiento</label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {submitting
              ? 'Guardando...'
              : pendingInvite
                ? 'Crear cuenta y unirme'
                : 'Guardar'}
          </button>
        </form>
      </div>
    </div>
  );
}
