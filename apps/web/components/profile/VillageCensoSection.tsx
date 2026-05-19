'use client';

import { useEffect, useMemo, useState } from 'react';
import { getMunicipality, getBarrios } from '@cultuvilla/shared/services/municipalityService';
import { getVillageMember } from '@cultuvilla/shared/services/villageMemberService';
import { saveProfileAnswers } from '@cultuvilla/shared/services/membershipProfileService';
import { isCensoComplete, missingRequiredAnswers } from '@cultuvilla/shared/services/censoService';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality';
import type {
  ProfileAnswers,
  ProfileFormField,
} from '@cultuvilla/shared/models/municipality/CensoTypes';
import { CensoFormRenderer } from './CensoFormRenderer';
import { ChevronDown, ChevronUp, CheckCircle, AlertCircle } from 'lucide-react';

interface Props {
  municipalityId: string;
  userId: string;
}

export function VillageCensoSection({ municipalityId, userId }: Props) {
  const [municipality, setMunicipality] = useState<(MunicipalityData & { id: string }) | null>(null);
  const [fields, setFields] = useState<ProfileFormField[]>([]);
  const [barrios, setBarrios] = useState<string[]>([]);
  const [answers, setAnswers] = useState<ProfileAnswers>({});
  const [savedAnswers, setSavedAnswers] = useState<ProfileAnswers>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [v, m, bs] = await Promise.all([
        getMunicipality(municipalityId),
        getVillageMember(municipalityId, userId),
        getBarrios(municipalityId),
      ]);
      if (cancelled) return;
      setMunicipality(v);
      const f = v?.community?.profileForm?.fields ?? [];
      setFields(f);
      setBarrios(bs.map((b) => b.name));
      const a = m?.profileAnswers ?? {};
      setAnswers(a);
      setSavedAnswers(a);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [municipalityId, userId]);

  const dirty = useMemo(
    () => JSON.stringify(answers) !== JSON.stringify(savedAnswers),
    [answers, savedAnswers],
  );
  const complete = useMemo(() => isCensoComplete(fields, savedAnswers), [fields, savedAnswers]);
  const missing = useMemo(() => missingRequiredAnswers(fields, savedAnswers), [fields, savedAnswers]);

  if (loading || !municipality) return null;
  if (fields.length === 0) return null;

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await saveProfileAnswers(municipalityId, userId, fields, answers);
      setSavedAnswers(answers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl mb-4 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          {complete ? (
            <CheckCircle size={18} className="text-green-500 shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-amber-500 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              Tu perfil en {municipality.name}
            </p>
            <p className="text-xs text-gray-500">
              {complete
                ? 'Completo'
                : missing.length > 0
                  ? `Faltan ${missing.length} respuesta${missing.length === 1 ? '' : 's'} obligatoria${missing.length === 1 ? '' : 's'}`
                  : 'Pendiente de respuesta'}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="p-4 border-t border-gray-100">
          <CensoFormRenderer
            fields={fields}
            answers={answers}
            onChange={setAnswers}
            barrios={barrios}
            disabled={saving}
          />
          {error && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="mt-4 w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40"
          >
            {saving ? 'Guardando…' : 'Guardar respuestas'}
          </button>
        </div>
      )}
    </div>
  );
}
