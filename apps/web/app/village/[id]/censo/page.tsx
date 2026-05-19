'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getMunicipality, getBarrios } from '@cultuvilla/shared/services/municipalityService';
import { getVillageMember } from '@cultuvilla/shared/services/villageMemberService';
import { saveProfileAnswers } from '@cultuvilla/shared/services/membershipProfileService';
import { isCensoComplete, missingRequiredAnswers } from '@cultuvilla/shared/services/censoService';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality';
import type { ProfileAnswers, ProfileFormField } from '@cultuvilla/shared/models/municipality/CensoTypes';
import { CensoFormRenderer } from '@/components/profile/CensoFormRenderer';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function VillageCensoPage({ params }: PageProps) {
  const { id: municipalityId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return');

  const [municipality, setMunicipality] = useState<(MunicipalityData & { id: string }) | null>(null);
  const [fields, setFields] = useState<ProfileFormField[]>([]);
  const [barrios, setBarrios] = useState<string[]>([]);
  const [answers, setAnswers] = useState<ProfileAnswers>({});
  const [savedAnswers, setSavedAnswers] = useState<ProfileAnswers>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      const [v, m, bs] = await Promise.all([
        getMunicipality(municipalityId),
        getVillageMember(municipalityId, user!.uid),
        getBarrios(municipalityId),
      ]);
      if (cancelled) return;
      setMunicipality(v);
      setFields(v?.community?.profileForm?.fields ?? []);
      setBarrios(bs.map((b) => b.name));
      const a = m?.profileAnswers ?? {};
      setAnswers(a);
      setSavedAnswers(a);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [municipalityId, user]);

  const dirty = useMemo(
    () => JSON.stringify(answers) !== JSON.stringify(savedAnswers),
    [answers, savedAnswers],
  );
  const complete = useMemo(() => isCensoComplete(fields, savedAnswers), [fields, savedAnswers]);
  const missing = useMemo(() => missingRequiredAnswers(fields, answers), [fields, answers]);

  if (authLoading || loading || !user) return <div className="p-8 text-center text-gray-500">Cargando…</div>;
  if (!municipality) return <div className="p-8 text-center text-gray-500">Pueblo no encontrado.</div>;

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await saveProfileAnswers(municipalityId, user!.uid, fields, answers);
      setSavedAnswers(answers);
      if (returnTo && missingRequiredAnswers(fields, answers).length === 0) {
        router.push(returnTo);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const back = returnTo ?? `/village/${municipalityId}`;

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-md mx-auto">
        <Link href={back} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft size={16} />
          Volver
        </Link>

        <h1 className="text-2xl font-bold mt-4">Censo de {municipality.name}</h1>
        <p className="text-sm text-gray-600 mt-1">
          Responde a estas preguntas para poder inscribirte a los eventos del pueblo.
        </p>

        {fields.length === 0 ? (
          <p className="mt-6 text-sm text-gray-500 italic">
            Este pueblo aún no ha definido un censo. Puedes inscribirte directamente a los eventos.
          </p>
        ) : (
          <div className="mt-6 bg-white border border-gray-200 rounded-xl p-4">
            <CensoFormRenderer
              fields={fields}
              answers={answers}
              onChange={setAnswers}
              barrios={barrios}
              disabled={saving}
            />
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        {!complete && missing.length > 0 && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
            Faltan {missing.length} campo{missing.length === 1 ? '' : 's'} obligatorio{missing.length === 1 ? '' : 's'}.
          </p>
        )}

        {fields.length > 0 && (
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="mt-4 w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-40"
          >
            {saving ? 'Guardando…' : returnTo ? 'Guardar y continuar' : 'Guardar'}
          </button>
        )}
      </div>
    </div>
  );
}
