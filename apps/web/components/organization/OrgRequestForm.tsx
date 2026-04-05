'use client';

import { useState } from 'react';
import type { OrganizationData } from '@villa-events/shared/models/organization';

interface OrgRequestFormProps {
  onSubmit: (data: { name: string; type: OrganizationData['type']; description: string | null }) => Promise<void>;
  onCancel: () => void;
}

const orgTypes: { value: OrganizationData['type']; label: string }[] = [
  { value: 'ayuntamiento', label: 'Ayuntamiento' },
  { value: 'peña', label: 'Peña' },
  { value: 'asociación', label: 'Asociación' },
];

export function OrgRequestForm({ onSubmit, onCancel }: OrgRequestFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<OrganizationData['type']>('asociación');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), type, description: description.trim() || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        placeholder="Nombre de la organización"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div>
        <label className="block text-xs text-gray-500 mb-1">Tipo</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as OrganizationData['type'])}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {orgTypes.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <textarea
        placeholder="Descripción (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition">
          Cancelar
        </button>
        <button type="submit" disabled={submitting} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
          {submitting ? 'Enviando...' : 'Solicitar'}
        </button>
      </div>
    </form>
  );
}
