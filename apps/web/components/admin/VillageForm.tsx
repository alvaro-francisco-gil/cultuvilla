'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { GeoPoint } from '@cultuvilla/shared/firebase';
import {
  getMunicipalities,
  activateCommunity,
  updateCommunity,
  updateMunicipality,
} from '@cultuvilla/shared/services/municipalityService';
import { setActiveMunicipality } from '@cultuvilla/shared/services/userService';
import {
  VillageFormSchema,
  type MunicipalityData,
  type VillageFormInput,
  type VillageFormValues,
} from '@cultuvilla/shared/models/municipality';
import { UserPicker } from './UserPicker';
import { LocationPicker } from './LocationPicker';
import { VillageImagesInput } from './VillageImagesInput';

interface LocationValue {
  lat: number;
  lng: number;
  displayName: string;
}

interface VillageFormProps {
  mode: 'create' | 'edit';
  currentUserId: string;
  initial?: MunicipalityData & { id: string };
  onSubmitted: () => void;
  onCancel?: () => void;
}

/**
 * Activate or edit a community on a municipality. In create mode the admin
 * picks an existing (already-seeded) municipality and provides the
 * community-specific bits (description, cover images, admin user, and
 * optionally coordinates if the municipality doesn't have them yet).
 *
 * In edit mode the community fields and the municipality's coordinates can
 * be updated; the underlying reference data (name/province/INE) is not
 * editable here — that lives in the municipalities admin page.
 */
export function VillageForm({
  mode,
  currentUserId,
  initial,
  onSubmitted,
  onCancel,
}: VillageFormProps) {
  const [allMunicipalities, setAllMunicipalities] = useState<(MunicipalityData & { id: string })[]>([]);

  const initialLocation: LocationValue | null = initial?.coordinates
    ? {
        lat: initial.coordinates.latitude,
        lng: initial.coordinates.longitude,
        displayName: `${initial.province}, ${initial.comunidadAutonoma}`,
      }
    : null;

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<VillageFormInput, unknown, VillageFormValues>({
    resolver: zodResolver(VillageFormSchema),
    defaultValues: {
      municipalityId: initial?.id ?? '',
      description: initial?.community?.description ?? '',
      adminUserId: initial?.community?.adminUserId ?? currentUserId,
      coverImages: initial?.community?.coverImages ?? [],
      location: initialLocation,
    },
  });

  const municipalityId = watch('municipalityId');
  const location = watch('location') as LocationValue | null;
  const coverImages = watch('coverImages') as string[];
  const adminUserId = watch('adminUserId');

  useEffect(() => {
    if (mode !== 'create') return;
    getMunicipalities().then(setAllMunicipalities);
  }, [mode]);

  const selectableMunicipalities = useMemo(
    () => allMunicipalities.filter((m) => !m.communityActive),
    [allMunicipalities],
  );

  const selectedMunicipality = useMemo(
    () => allMunicipalities.find((m) => m.id === municipalityId) ?? initial ?? null,
    [allMunicipalities, municipalityId, initial],
  );

  const submit = handleSubmit(async (data) => {
    const needsCoords = !selectedMunicipality?.coordinates;
    if (needsCoords && !data.location) {
      setError('location', { message: 'Selecciona la ubicación' });
      return;
    }

    const coordinates = data.location
      ? new GeoPoint(data.location.lat, data.location.lng)
      : selectedMunicipality?.coordinates ?? null;

    try {
      if (mode === 'create') {
        await activateCommunity(data.municipalityId, {
          description: data.description,
          coverImages: data.coverImages,
          adminUserId: data.adminUserId,
          coordinates,
        });
        if (data.adminUserId === currentUserId) {
          await setActiveMunicipality(currentUserId, data.municipalityId);
        }
      } else {
        await updateCommunity(data.municipalityId, {
          description: data.description,
          coverImages: data.coverImages,
          adminUserId: data.adminUserId,
        });
        if (data.location) {
          await updateMunicipality(data.municipalityId, { coordinates });
        }
      }
      onSubmitted();
    } catch (e) {
      setError('root', { message: e instanceof Error ? e.message : 'Error al guardar' });
    }
  });

  const inputClass =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <form onSubmit={submit} className="bg-white border border-gray-200 rounded-lg p-4 space-y-4" noValidate>
      {mode === 'create' ? (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Municipio</label>
          <select
            className={inputClass}
            value={municipalityId}
            onChange={(e) => setValue('municipalityId', e.target.value, { shouldValidate: true })}
          >
            <option value="">Selecciona…</option>
            {selectableMunicipalities.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.province})
              </option>
            ))}
          </select>
          {selectableMunicipalities.length === 0 && allMunicipalities.length > 0 && (
            <p className="mt-1 text-xs text-amber-600">
              Todos los municipios disponibles ya tienen comunidad activa.
            </p>
          )}
          {errors.municipalityId && (
            <p className="text-xs text-red-600 mt-1">{errors.municipalityId.message}</p>
          )}
        </div>
      ) : (
        initial && (
          <div className="text-sm text-gray-600">
            <p className="font-medium text-gray-900">{initial.name}</p>
            <p className="text-xs text-gray-500">{initial.province}, {initial.comunidadAutonoma}</p>
            <input type="hidden" {...register('municipalityId')} />
          </div>
        )
      )}

      <div>
        <textarea
          className={inputClass}
          placeholder="Descripción del pueblo"
          rows={2}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>
        )}
      </div>

      <div>
        <LocationPicker
          value={location}
          onChange={(v) => setValue('location', v, { shouldValidate: true })}
        />
        {errors.location && (
          <p className="text-xs text-red-600 mt-1">{errors.location.message}</p>
        )}
      </div>

      {municipalityId && (
        <VillageImagesInput
          municipalityId={municipalityId}
          value={coverImages}
          onChange={(v) => setValue('coverImages', v, { shouldValidate: true })}
        />
      )}

      <div>
        <UserPicker
          value={adminUserId}
          onChange={(v) => setValue('adminUserId', v, { shouldValidate: true })}
          label="Coordinador del pueblo"
        />
        {errors.adminUserId && (
          <p className="text-xs text-red-600 mt-1">{errors.adminUserId.message}</p>
        )}
      </div>

      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

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
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium disabled:opacity-50"
        >
          {isSubmitting ? 'Guardando...' : mode === 'create' ? 'Activar comunidad' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
