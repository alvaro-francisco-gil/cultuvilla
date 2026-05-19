'use client';

import { useState } from 'react';
import { GeoPoint } from '@cultuvilla/shared/firebase';
import {
  createVillage,
  generateVillageId,
  updateVillage,
} from '@cultuvilla/shared/services/villageService';
import { setActiveVillage } from '@cultuvilla/shared/services/userService';
import {
  COUNTRIES,
  COMUNIDADES_AUTONOMAS,
  PROVINCIAS_BY_COMUNIDAD,
  type ComunidadAutonoma,
  type VillageData,
} from '@cultuvilla/shared/models/village';
import { UserPicker } from './UserPicker';
import { LocationPicker } from './LocationPicker';
import { BarriosInput } from './BarriosInput';
import { VillageImagesInput } from './VillageImagesInput';

interface LocationValue {
  lat: number;
  lng: number;
  displayName: string;
}

interface VillageFormProps {
  mode: 'create' | 'edit';
  currentUserId: string;
  initial?: VillageData & { id: string };
  onSubmitted: () => void;
  onCancel?: () => void;
}

export function VillageForm({
  mode,
  currentUserId,
  initial,
  onSubmitted,
  onCancel,
}: VillageFormProps) {
  // Stable village id: existing one in edit mode, freshly generated in create mode.
  const [villageId] = useState(() => initial?.id ?? generateVillageId());

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [country, setCountry] = useState<string>(initial?.country ?? COUNTRIES[0].name);
  const [comunidadAutonoma, setComunidadAutonoma] = useState<ComunidadAutonoma | ''>(
    (initial?.comunidadAutonoma as ComunidadAutonoma | undefined) ?? '',
  );
  const [provincia, setProvincia] = useState(initial?.provincia ?? '');
  const [location, setLocation] = useState<LocationValue | null>(
    initial
      ? {
          lat: initial.coordinates.latitude,
          lng: initial.coordinates.longitude,
          displayName: `${initial.provincia}, ${initial.comunidadAutonoma}`,
        }
      : null,
  );
  const [barrios, setBarrios] = useState<string[]>(initial?.barrios ?? []);
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [adminUserId, setAdminUserId] = useState(initial?.adminUserId ?? currentUserId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const provinciaOptions = comunidadAutonoma ? PROVINCIAS_BY_COMUNIDAD[comunidadAutonoma] : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!comunidadAutonoma) return setError('Selecciona una comunidad autónoma');
    if (!provincia) return setError('Selecciona una provincia');
    if (!location) return setError('Selecciona la ubicación');
    if (!adminUserId) return setError('Selecciona el administrador');

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        country,
        comunidadAutonoma,
        provincia,
        coordinates: new GeoPoint(location.lat, location.lng),
        barrios,
        images,
        adminUserId,
      };

      if (mode === 'create') {
        await createVillage(payload, villageId);
        if (adminUserId === currentUserId) {
          await setActiveVillage(currentUserId, villageId);
        }
      } else {
        await updateVillage(villageId, payload);
      }

      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <input
        className={inputClass}
        placeholder="Nombre del pueblo"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <textarea
        className={inputClass}
        placeholder="Descripción"
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />

      <div>
        <label className="block text-xs text-gray-500 mb-1">País</label>
        <select className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)}>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Comunidad Autónoma</label>
        <select
          className={inputClass}
          value={comunidadAutonoma}
          onChange={(e) => {
            setComunidadAutonoma(e.target.value as ComunidadAutonoma);
            setProvincia('');
          }}
          required
        >
          <option value="">Selecciona...</option>
          {COMUNIDADES_AUTONOMAS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Provincia</label>
        <select
          className={inputClass}
          value={provincia}
          onChange={(e) => setProvincia(e.target.value)}
          disabled={!comunidadAutonoma}
          required
        >
          <option value="">Selecciona...</option>
          {provinciaOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <LocationPicker value={location} onChange={setLocation} />

      <BarriosInput value={barrios} onChange={setBarrios} />

      <VillageImagesInput villageId={villageId} value={images} onChange={setImages} />

      <UserPicker value={adminUserId} onChange={setAdminUserId} label="Coordinador del pueblo" />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium disabled:opacity-50"
        >
          {submitting ? 'Guardando...' : mode === 'create' ? 'Crear pueblo' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
