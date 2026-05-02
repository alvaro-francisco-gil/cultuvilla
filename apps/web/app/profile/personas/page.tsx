'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { usePersonas } from '@/hooks/usePersonas';
import { createPersona, updatePersona, deletePersona } from '@villa-events/shared/services/personaService';
import { uploadPersonImage } from '@villa-events/shared/services/imageService';
import type { PersonaData } from '@villa-events/shared/models/user';
import { PersonaCard } from '@/components/profile/PersonaCard';
import { PersonaForm } from '@/components/profile/PersonaForm';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';
import { ArrowLeft, Plus } from 'lucide-react';

export default function PersonasPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { personas, loading, reload } = usePersonas();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="px-4 py-6 space-y-4">
        <SkeletonLoader className="h-8 w-48" />
        {[1, 2].map((i) => <SkeletonLoader key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  if (!user) return null;

  const handleAdd = async (data: { name: string; birthday: Date; biography: string | null; photoFile: File | null }) => {
    const personaId = await createPersona(user.uid, data);
    if (data.photoFile) {
      const photoURL = await uploadPersonImage(personaId, data.photoFile);
      await updatePersona(user.uid, personaId, { photoURL });
    }
    setShowAddForm(false);
    reload();
  };

  const handleEdit = async (
    personaId: string,
    data: { name: string; birthday: Date; biography: string | null; photoFile: File | null }
  ) => {
    let photoURL: string | undefined;
    if (data.photoFile) {
      photoURL = await uploadPersonImage(personaId, data.photoFile);
    }
    await updatePersona(user.uid, personaId, { name: data.name, biography: data.biography, ...(photoURL !== undefined && { photoURL }) });
    setEditingId(null);
    reload();
  };

  const handleDelete = async (personaId: string) => {
    if (!confirm('¿Eliminar este acompañante?')) return;
    await deletePersona(user.uid, personaId);
    reload();
  };

  return (
    <div className="px-4 py-6">
      <Link href="/profile" className="flex items-center gap-1 text-blue-600 text-sm mb-4">
        <ArrowLeft size={16} /> Mi perfil
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Acompañantes</h1>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
          >
            <Plus size={16} /> Añadir
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Nuevo acompañante</h2>
          <PersonaForm
            onSubmit={handleAdd}
            onCancel={() => setShowAddForm(false)}
            submitLabel="Añadir"
          />
        </div>
      )}

      {personas.length === 0 && !showAddForm ? (
        <p className="text-gray-500 text-center py-12 text-sm">
          No has añadido ningún acompañante todavía.
        </p>
      ) : (
        <div className="space-y-3">
          {personas.map((persona) =>
            editingId === persona.id ? (
              <div key={persona.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Editar</h2>
                <PersonaForm
                  initial={{ name: persona.name, birthday: persona.birthday, biography: persona.biography, photoURL: persona.photoURL }}
                  onSubmit={(data) => handleEdit(persona.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <PersonaCard
                key={persona.id}
                persona={persona}
                onEdit={() => setEditingId(persona.id)}
                onDelete={() => handleDelete(persona.id)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
