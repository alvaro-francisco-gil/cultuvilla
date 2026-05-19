'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useVillage } from '@/hooks/useVillage';
import { useIsAppAdmin } from '@/hooks/useIsAppAdmin';
import { getVillageMembers } from '@cultuvilla/shared/services/villageMemberService';
import { updateCensoSchema } from '@cultuvilla/shared/services/censoService';
import { collectUsedValues } from '@cultuvilla/shared/services/membershipProfileService';
import type { ProfileFormField } from '@cultuvilla/shared/models/municipality/CensoTypes';
import { CensoFieldList } from '@/components/admin/CensoFieldList';
import { AddCensoFieldDialog } from '@/components/admin/AddCensoFieldDialog';
import { ArrowLeft, Plus, Save } from 'lucide-react';

interface CensoAdminPageProps {
  params: Promise<{ id: string }>;
}

export default function CensoAdminPage({ params }: CensoAdminPageProps) {
  const { id: municipalityId } = use(params);
  const { user } = useAuth();
  const { municipality, isAdmin, loading: villageLoading } = useVillage();
  const { isAppAdmin, loading: appAdminLoading } = useIsAppAdmin();
  const router = useRouter();
  const canManage = isAdmin || isAppAdmin;

  const [fields, setFields] = useState<ProfileFormField[]>([]);
  const [lockedKeys, setLockedKeys] = useState<Set<string>>(new Set());
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (villageLoading || appAdminLoading) return;
    if (!user) return;
    if (!canManage) router.push(`/village/${municipalityId}`);
  }, [user, canManage, villageLoading, appAdminLoading, router, municipalityId]);

  useEffect(() => {
    if (!canManage || !municipality) return;
    const currentForm = municipality.community?.profileForm?.fields ?? [];
    async function load() {
      const members = await getVillageMembers(municipalityId);
      setMemberCount(members.length);
      const used = collectUsedValues(members);
      const locked = new Set(
        Object.entries(used)
          .filter(([, vals]) => vals.size > 0)
          .map(([k]) => k),
      );
      setLockedKeys(locked);
      setFields(currentForm);
      setLoading(false);
    }
    load();
  }, [municipalityId, canManage, municipality]);

  const existingKeys = useMemo(() => fields.map((f) => f.key), [fields]);
  const dirty = useMemo(
    () => JSON.stringify(fields) !== JSON.stringify(municipality?.community?.profileForm?.fields ?? []),
    [fields, municipality],
  );

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await updateCensoSchema(municipalityId, fields);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  if (villageLoading || appAdminLoading || loading) {
    return <div className="p-8 text-center text-gray-500">Cargando…</div>;
  }
  if (!canManage) return null;

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <Link
          href={`/village/${municipalityId}/admin`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Volver al panel del pueblo
        </Link>

        <h1 className="text-2xl font-bold mt-4">Censo del pueblo</h1>
        <p className="text-sm text-gray-600 mt-1">
          Define las preguntas que los miembros deben responder. Los campos marcados como obligatorios
          tienen que estar respondidos antes de inscribirse a cualquier evento.
        </p>
        {memberCount > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            {memberCount} {memberCount === 1 ? 'miembro' : 'miembros'} en el pueblo. Los campos con un
            🔒 ya han sido respondidos y no se pueden eliminar.
          </p>
        )}

        <div className="mt-6">
          <CensoFieldList
            fields={fields}
            lockedKeys={lockedKeys}
            onChange={setFields}
          />
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600 rounded-xl py-3 text-sm font-medium transition"
        >
          <Plus size={18} />
          Añadir campo
        </button>

        {error && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-4 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
            Censo guardado correctamente.
          </p>
        )}

        <div className="mt-6 sticky bottom-4">
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-medium disabled:opacity-40 hover:bg-blue-700 transition"
          >
            <Save size={18} />
            {saving ? 'Guardando…' : 'Guardar censo'}
          </button>
        </div>
      </div>

      {showAdd && (
        <AddCensoFieldDialog
          existingKeys={existingKeys}
          onAdd={(f) => setFields((prev) => [...prev, f])}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
