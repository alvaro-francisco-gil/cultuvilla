'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { isAppAdmin } from '@cultuvilla/shared/services/adminService';
import { getActiveCommunities } from '@cultuvilla/shared/services/municipalityService';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality';
import { TopBar } from '@/components/common/TopBar';
import { VillageForm } from '@/components/admin/VillageForm';
import { Pencil, Settings, Plus, MapPin, Briefcase, UserPlus } from 'lucide-react';

type Status = 'checking' | 'allowed';
type FormMode =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; municipality: MunicipalityData & { id: string } };

export default function AdminPage() {
  const { user, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('checking');
  const [communities, setCommunities] = useState<(MunicipalityData & { id: string })[]>([]);
  const [form, setForm] = useState<FormMode>({ kind: 'closed' });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    isAppAdmin(user.uid).then((ok) => {
      if (ok) setStatus('allowed');
      else router.replace('/');
    });
  }, [user, loading, router]);

  useEffect(() => {
    if (status !== 'allowed') return;
    getActiveCommunities().then(setCommunities);
  }, [status]);

  const reloadCommunities = async () => {
    setCommunities(await getActiveCommunities());
  };

  if (loading || status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  return (
    <>
      <TopBar title="Administración" />
      <div className="p-4 space-y-6">

        {/* Navigation hub */}
        <section className="space-y-3">
          <h2 className="font-semibold">Datos de referencia</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/admin/municipalities"
              className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-blue-50 hover:border-blue-200 transition"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                <MapPin size={20} />
              </div>
              <span className="text-sm font-medium text-gray-700 text-center">Municipios</span>
              <span className="text-xs text-gray-400 text-center">Barrios y cementerios</span>
            </Link>
            <Link
              href="/admin/occupations"
              className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-blue-50 hover:border-blue-200 transition"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                <Briefcase size={20} />
              </div>
              <span className="text-sm font-medium text-gray-700 text-center">Ocupaciones</span>
              <span className="text-xs text-gray-400 text-center">Aprobadas y propuestas</span>
            </Link>
            <Link
              href="/admin/organizer-requests"
              className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-blue-50 hover:border-blue-200 transition"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                <UserPlus size={20} />
              </div>
              <span className="text-sm font-medium text-gray-700 text-center">Solicitudes de organizador</span>
              <span className="text-xs text-gray-400 text-center">Revisar pendientes</span>
            </Link>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Pueblos con comunidad activa</h2>
            {form.kind === 'closed' ? (
              <button
                onClick={() => setForm({ kind: 'create' })}
                className="text-sm text-blue-600 flex items-center gap-1"
              >
                <Plus size={14} /> Activar pueblo
              </button>
            ) : (
              <button onClick={() => setForm({ kind: 'closed' })} className="text-sm text-gray-500">
                Cerrar formulario
              </button>
            )}
          </div>

          {form.kind === 'create' && (
            <VillageForm
              mode="create"
              currentUserId={user!.uid}
              onSubmitted={async () => {
                setForm({ kind: 'closed' });
                await reloadCommunities();
                await refreshProfile();
              }}
              onCancel={() => setForm({ kind: 'closed' })}
            />
          )}

          {form.kind === 'edit' && (
            <VillageForm
              mode="edit"
              currentUserId={user!.uid}
              initial={form.municipality}
              onSubmitted={async () => {
                setForm({ kind: 'closed' });
                await reloadCommunities();
              }}
              onCancel={() => setForm({ kind: 'closed' })}
            />
          )}

          {communities.length === 0 ? (
            <p className="text-sm text-gray-500">Aún no hay pueblos con comunidad activa.</p>
          ) : (
            <ul className="space-y-2">
              {communities.map((m) => {
                const cover = m.community?.coverImages[0];
                return (
                  <li
                    key={m.id}
                    className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3"
                  >
                    {cover ? (
                      <img src={cover} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                        {m.name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <Link href={`/village/${m.id}`} className="block">
                        <p className="font-medium truncate">{m.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {m.province}, {m.comunidadAutonoma}
                        </p>
                      </Link>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setForm({ kind: 'edit', municipality: m })}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        title="Editar comunidad"
                      >
                        <Pencil size={15} />
                      </button>
                      <Link
                        href={`/village/${m.id}/admin`}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        title="Gestionar (invitaciones, organizaciones)"
                      >
                        <Settings size={15} />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
