'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  setActiveVillage,
  updateUserProfile,
} from '@villa-events/shared/services/userService';
import {
  getUserMemberships,
  type UserMembership,
} from '@villa-events/shared/services/villageMemberService';
import { getVillage } from '@villa-events/shared/services/villageService';
import type { VillageData } from '@villa-events/shared/models/village';
import { User, Pencil, Users, LogOut, MapPin, Shield, Settings } from 'lucide-react';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';
import { useIsAppAdmin } from '@/hooks/useIsAppAdmin';
import { VillageCensoSection } from '@/components/profile/VillageCensoSection';

type VillageSummary = VillageData & { id: string };

export default function ProfilePage() {
  const { user, loading: authLoading, signOut, profile, refreshProfile } = useAuth();
  const { isAppAdmin } = useIsAppAdmin();
  const router = useRouter();

  const [editMode, setEditMode] = useState(false);
  const [telephone, setTelephone] = useState('');
  const [biography, setBiography] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [villagesById, setVillagesById] = useState<Record<string, VillageSummary>>({});
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (profile) {
      setTelephone(profile.telephone ?? '');
      setBiography(profile.biography ?? '');
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    getUserMemberships(user.uid).then(async (mems) => {
      setMemberships(mems);
      const ids = new Set(mems.map((m) => m.villageId));
      if (profile?.activeVillageId) ids.add(profile.activeVillageId);
      const villages = await Promise.all(Array.from(ids).map((id) => getVillage(id)));
      const map: Record<string, VillageSummary> = {};
      villages.forEach((v) => { if (v) map[v.id] = v; });
      setVillagesById(map);
    });
  }, [user, profile?.activeVillageId]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      await updateUserProfile(user.uid, {
        telephone: telephone.trim() || null,
        biography: biography.trim() || null,
      });
      await refreshProfile();
      setEditMode(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleSwitchVillage = async (villageId: string) => {
    if (!user || villageId === profile?.activeVillageId) return;
    setSwitching(true);
    try {
      await setActiveVillage(user.uid, villageId);
      await refreshProfile();
      router.push(`/village/${villageId}`);
    } finally {
      setSwitching(false);
    }
  };

  if (authLoading || !profile) {
    return (
      <div className="px-4 py-6 space-y-4">
        <SkeletonLoader className="h-16 w-16 rounded-full" />
        <SkeletonLoader className="h-6 w-40" />
        <SkeletonLoader className="h-4 w-56" />
      </div>
    );
  }

  if (!user) return null;

  const displayName = profile.displayName ?? user.displayName ?? 'Sin nombre';
  const photoURL = profile.photoURL ?? user.photoURL;
  const adminMemberships = memberships.filter((m) => m.role === 'admin');
  const showManagementSection = isAppAdmin || adminMemberships.length > 0;

  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi perfil</h1>

      {/* Avatar + name */}
      <div className="flex items-center gap-4 mb-6">
        {photoURL ? (
          <img src={photoURL} alt={displayName} className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <User size={28} className="text-gray-400" />
          </div>
        )}
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{displayName}</h2>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </div>

      {/* My villages */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={18} className="text-gray-500" />
          <p className="text-sm font-semibold text-gray-900">Mis pueblos</p>
        </div>
        {memberships.length === 0 ? (
          <p className="text-sm text-gray-500">Aún no perteneces a ningún pueblo.</p>
        ) : (
          <ul className="space-y-2">
            {memberships.map((m) => {
              const v = villagesById[m.villageId];
              if (!v) return null;
              const isActive = m.villageId === profile.activeVillageId;
              return (
                <li key={m.villageId} className="flex items-center justify-between">
                  <Link href={`/village/${m.villageId}`} className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{v.name}</p>
                    <p className="text-xs text-gray-400">{v.provincia}</p>
                    {m.profileCompletedAt ? (
                      <span className="text-xs text-emerald-600">Censo completo</span>
                    ) : (
                      <Link href={`/village/${m.villageId}/censo`} className="text-xs text-amber-600 hover:underline">
                        Completar censo
                      </Link>
                    )}
                  </Link>
                  {isActive ? (
                    <span className="text-xs text-blue-700 px-2 py-0.5 rounded-full bg-blue-50">Principal</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSwitchVillage(m.villageId)}
                      disabled={switching}
                      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                    >
                      Hacer principal
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Profile details */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        {!editMode ? (
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <h3 className="text-sm font-semibold text-gray-700">Información</h3>
              <button onClick={() => setEditMode(true)} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm">
                <Pencil size={13} /> Editar
              </button>
            </div>
            <div>
              <p className="text-xs text-gray-500">Teléfono</p>
              <p className="text-sm text-gray-900">{profile.telephone ?? 'No añadido'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Biografía</p>
              <p className="text-sm text-gray-900 whitespace-pre-line">{profile.biography ?? 'No añadida'}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Editar información</h3>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Teléfono</label>
              <input
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+34 600 000 000"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Biografía</label>
              <textarea
                value={biography}
                onChange={(e) => setBiography(e.target.value)}
                rows={3}
                placeholder="Cuéntanos algo sobre ti..."
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setEditMode(false)} className="flex-1 border border-gray-300 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Censo per village */}
      {memberships.map((m) => (
        <VillageCensoSection
          key={m.villageId}
          villageId={m.villageId}
          userId={user.uid}
        />
      ))}

      {/* Link to persons */}
      <Link href="/profile/persons" className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4 mb-4 hover:bg-gray-50 transition">
        <div className="flex items-center gap-3">
          <Users size={20} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-900">Familiares / Acompañantes</span>
        </div>
        <span className="text-gray-400 text-lg">›</span>
      </Link>

      {/* Management tools */}
      {showManagementSection && (
        <div className="bg-white border border-gray-200 rounded-xl mb-4 overflow-hidden">
          <div className="px-4 pt-3 pb-1">
            <h3 className="text-xs uppercase tracking-wide font-semibold text-gray-400">Herramientas de gestión</h3>
          </div>

          {isAppAdmin && (
            <Link href="/admin" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-t border-gray-100 transition">
              <div className="flex items-center gap-3">
                <Shield size={18} className="text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Administración global</p>
                  <p className="text-xs text-gray-500">Crear y editar pueblos</p>
                </div>
              </div>
              <span className="text-gray-400 text-lg">›</span>
            </Link>
          )}

          {adminMemberships.map((m) => {
            const v = villagesById[m.villageId];
            if (!v) return null;
            return (
              <Link
                key={m.villageId}
                href={`/village/${m.villageId}/admin`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-t border-gray-100 transition"
              >
                <div className="flex items-center gap-3">
                  <Settings size={18} className="text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Coordinar {v.name}</p>
                    <p className="text-xs text-gray-500">Invitaciones, organizaciones, miembros</p>
                  </div>
                </div>
                <span className="text-gray-400 text-lg">›</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 py-3 rounded-xl text-sm font-medium hover:bg-red-50 transition"
      >
        <LogOut size={16} />
        Cerrar sesión
      </button>
    </div>
  );
}
