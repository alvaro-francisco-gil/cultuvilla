'use client';

import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { acceptInvite, validateInviteToken } from '@cultuvilla/shared/services/inviteTokenService';
import { isVillageMember } from '@cultuvilla/shared/services/villageMemberService';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality';
import { useAuth } from '@/hooks/useAuth';
import { CheckCircle, XCircle, Loader, MapPin } from 'lucide-react';

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

type State = 'loading' | 'invalid' | 'already-member' | 'joining' | 'joined' | 'unauthenticated' | 'error';

const PENDING_INVITE_KEY = 'cultuvilla:pendingInvite';

export default function InvitePage({ params }: InvitePageProps) {
  const { token } = use(params);
  const searchParams = useSearchParams();
  const municipalityId = searchParams.get('v') ?? '';
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<State>('loading');
  const [municipality, setMunicipality] = useState<(MunicipalityData & { id: string }) | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!municipalityId) {
      setState('invalid');
      return;
    }

    async function validate() {
      try {
        const [valid, v] = await Promise.all([
          validateInviteToken(municipalityId, token),
          getMunicipality(municipalityId),
        ]);
        setMunicipality(v);

        if (!valid) {
          setState('invalid');
          return;
        }

        if (!user) {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(
              PENDING_INVITE_KEY,
              `/invite/${token}?v=${municipalityId}`,
            );
          }
          setState('unauthenticated');
          return;
        }

        const alreadyMember = await isVillageMember(municipalityId, user.uid);
        if (alreadyMember) {
          setState('already-member');
          return;
        }

        setState('joining');
        const result = await acceptInvite(municipalityId, token);
        await refreshProfile();

        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(PENDING_INVITE_KEY);
        }

        setState(result.alreadyMember ? 'already-member' : 'joined');
        setTimeout(() => router.push(`/village/${municipalityId}`), 1500);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Error desconocido');
        setState('error');
      }
    }

    validate();
  }, [authLoading, user, municipalityId, token, router, refreshProfile]);

  if (state === 'loading' || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
        <Loader size={32} className="animate-spin text-blue-500" />
        <p className="text-gray-600">Validando enlace de invitación...</p>
      </div>
    );
  }

  if (state === 'unauthenticated') {
    return (
      <div className="min-h-screen px-4 py-8">
        <div className="max-w-md mx-auto">
          <VillageHeader municipality={municipality} />
          <div className="mt-6 text-center">
            <h1 className="text-xl font-bold text-gray-900">
              Te han invitado a {municipality?.name ?? 'este pueblo'}
            </h1>
            <p className="text-gray-600 text-sm mt-2">
              Inicia sesión o crea una cuenta para unirte.
            </p>
            <Link
              href={`/login?redirect=/invite/${token}?v=${municipalityId}`}
              className="inline-block mt-4 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4 text-center">
        <XCircle size={48} className="text-red-500" />
        <h1 className="text-xl font-bold text-gray-900">Enlace no válido</h1>
        <p className="text-gray-600 text-sm">Este enlace de invitación ha expirado o no es válido.</p>
        <Link href="/" className="text-blue-600 hover:underline text-sm">Volver al inicio</Link>
      </div>
    );
  }

  if (state === 'already-member') {
    return (
      <div className="min-h-screen px-4 py-8">
        <div className="max-w-md mx-auto">
          <VillageHeader municipality={municipality} />
          <div className="mt-6 text-center">
            <CheckCircle size={36} className="text-green-500 mx-auto mb-2" />
            <h1 className="text-xl font-bold text-gray-900">Ya eres miembro</h1>
            <p className="text-gray-600 text-sm mt-1">Ya perteneces a {municipality?.name ?? 'este pueblo'}.</p>
            <Link href={`/village/${municipalityId}`} className="inline-block mt-4 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition">
              Ir al pueblo
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'joined') {
    return (
      <div className="min-h-screen px-4 py-8">
        <div className="max-w-md mx-auto">
          <VillageHeader municipality={municipality} />
          <div className="mt-6 text-center">
            <CheckCircle size={36} className="text-green-500 mx-auto mb-2" />
            <h1 className="text-xl font-bold text-gray-900">¡Bienvenido!</h1>
            <p className="text-gray-600 text-sm mt-1">Te has unido a {municipality?.name ?? 'el pueblo'} correctamente.</p>
            <p className="text-xs text-gray-400 mt-1">Redirigiendo...</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'joining') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
        <Loader size={32} className="animate-spin text-blue-500" />
        <p className="text-gray-600">Uniéndote al pueblo...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4 text-center">
      <XCircle size={48} className="text-red-500" />
      <h1 className="text-xl font-bold text-gray-900">Error</h1>
      <p className="text-gray-600 text-sm">{errorMsg}</p>
      <Link href="/" className="text-blue-600 hover:underline text-sm">Volver al inicio</Link>
    </div>
  );
}

function VillageHeader({ municipality }: { municipality: (MunicipalityData & { id: string }) | null }) {
  if (!municipality) {
    return (
      <div className="w-full h-44 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center">
        <Loader size={28} className="animate-spin text-blue-400" />
      </div>
    );
  }

  const coverImages = municipality.community?.coverImages ?? [];

  return (
    <div>
      {coverImages.length > 0 ? (
        <div className="space-y-2">
          <img
            src={coverImages[0]}
            alt={municipality.name}
            className="w-full h-48 object-cover rounded-2xl"
          />
          {coverImages.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {coverImages.slice(1, 5).map((url) => (
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="aspect-square w-full object-cover rounded-lg"
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-44 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center">
          <span className="text-blue-500 text-5xl font-bold">{municipality.name[0]}</span>
        </div>
      )}

      <div className="mt-4 flex items-center gap-1 text-sm text-gray-500">
        <MapPin size={14} />
        <span>{municipality.province}, {municipality.comunidadAutonoma}</span>
      </div>

      {municipality.community?.description && (
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">{municipality.community.description}</p>
      )}
    </div>
  );
}
