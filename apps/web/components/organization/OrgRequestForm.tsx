'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  OrgRequestFormSchema,
  type OrgRequestFormInput,
  type OrgRequestFormValues,
  type OrganizationData,
} from '@cultuvilla/shared/models/organization';

interface OrgRequestFormProps {
  onSubmit: (data: OrgRequestFormValues) => Promise<void>;
  onCancel: () => void;
}

const orgTypes: { value: OrganizationData['type']; label: string }[] = [
  { value: 'ayuntamiento', label: 'Ayuntamiento' },
  { value: 'peña', label: 'Peña' },
  { value: 'asociación', label: 'Asociación' },
];

const inputCls =
  'w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export function OrgRequestForm({ onSubmit, onCancel }: OrgRequestFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OrgRequestFormInput, unknown, OrgRequestFormValues>({
    resolver: zodResolver(OrgRequestFormSchema),
    defaultValues: { name: '', type: 'asociación', description: '' },
  });

  const submit = handleSubmit(async (data) => {
    try {
      await onSubmit(data);
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Error al enviar' });
    }
  });

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div>
        <input
          type="text"
          placeholder="Nombre de la organización"
          {...register('name')}
          className={inputCls}
        />
        {errors.name && <p className="text-xs text-red-600 mt-1 ml-1">{errors.name.message}</p>}
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Tipo</label>
        <select {...register('type')} className={`${inputCls} bg-white`}>
          {orgTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        placeholder="Descripción (opcional)"
        {...register('description')}
        rows={3}
        className={`${inputCls} resize-none`}
      />
      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-300 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {isSubmitting ? 'Enviando...' : 'Solicitar'}
        </button>
      </div>
    </form>
  );
}
