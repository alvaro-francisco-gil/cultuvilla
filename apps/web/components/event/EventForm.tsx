'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  EventFormSchema,
  type EventData,
  type EventFormInput,
  type EventFormValues,
} from '@cultuvilla/shared/models/event';
import type { LocationData } from '@cultuvilla/shared/models/core';

export interface EventFormData {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date | null;
  location: LocationData;
  price: number | null;
  maxAttendees: number | null;
  telephoneRequired: boolean;
}

interface EventFormProps {
  initial?: Partial<EventData>;
  onSubmit: (data: EventFormData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  extraActions?: React.ReactNode;
}

function toInputDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const inputCls =
  'w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export function EventForm({ initial, onSubmit, onCancel, submitLabel = 'Guardar', extraActions }: EventFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EventFormInput, unknown, EventFormValues>({
    resolver: zodResolver(EventFormSchema),
    defaultValues: {
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      startDate: initial?.startDate ? toInputDateTime(initial.startDate) : '',
      endDate: initial?.endDate ? toInputDateTime(initial.endDate) : '',
      locationText: initial?.location?.text ?? '',
      price: initial?.price !== null && initial?.price !== undefined ? String(initial.price) : '',
      maxAttendees:
        initial?.maxAttendees !== null && initial?.maxAttendees !== undefined ? String(initial.maxAttendees) : '',
      telephoneRequired: initial?.telephoneRequired ?? false,
    },
  });

  const submit = handleSubmit(async (data) => {
    const location: LocationData = {
      type: 'text',
      coordinates: null,
      text: data.locationText,
    };
    try {
      await onSubmit({
        title: data.title,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        location,
        price: data.price,
        maxAttendees: data.maxAttendees,
        telephoneRequired: data.telephoneRequired,
      });
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Error al guardar' });
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Título *</label>
        <input type="text" {...register('title')} placeholder="Nombre del evento" className={inputCls} />
        {errors.title && <p className="text-xs text-red-600 mt-1 ml-1">{errors.title.message}</p>}
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Descripción</label>
        <textarea
          {...register('description')}
          rows={4}
          placeholder="Describe el evento..."
          className={`${inputCls} resize-none`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Fecha inicio *</label>
          <input type="datetime-local" {...register('startDate')} className={inputCls} />
          {errors.startDate && <p className="text-xs text-red-600 mt-1 ml-1">{errors.startDate.message}</p>}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Fecha fin</label>
          <input type="datetime-local" {...register('endDate')} className={inputCls} />
          {errors.endDate && <p className="text-xs text-red-600 mt-1 ml-1">{errors.endDate.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Ubicación</label>
        <input type="text" {...register('locationText')} placeholder="Plaza Mayor, Calle..." className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Precio (€)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            {...register('price')}
            placeholder="0 = gratis"
            className={inputCls}
          />
          {errors.price && <p className="text-xs text-red-600 mt-1 ml-1">{errors.price.message}</p>}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Plazas máx.</label>
          <input type="number" min="1" {...register('maxAttendees')} placeholder="Sin límite" className={inputCls} />
          {errors.maxAttendees && (
            <p className="text-xs text-red-600 mt-1 ml-1">{errors.maxAttendees.message}</p>
          )}
        </div>
      </div>

      <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
        <input type="checkbox" {...register('telephoneRequired')} className="accent-blue-600" />
        <div>
          <p className="text-sm font-medium text-gray-900">Requerir teléfono</p>
          <p className="text-xs text-gray-500">Los asistentes deben tener teléfono en su perfil</p>
        </div>
      </label>

      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-gray-300 py-3 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {isSubmitting ? 'Guardando...' : submitLabel}
        </button>
      </div>

      {extraActions}
    </form>
  );
}
