'use client';

import { useMemo, useState } from 'react';
import {
  listPredefinedFields,
  type PredefinedFieldDefinition,
} from '@cultuvilla/shared/models/municipality/profileFieldRegistry';
import {
  slugifyFieldKey,
  type ProfileFormField,
  type FieldType,
} from '@cultuvilla/shared/models/municipality/CensoTypes';
import { X } from 'lucide-react';

interface Props {
  existingKeys: string[];
  onAdd: (field: ProfileFormField) => void;
  onClose: () => void;
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Texto corto',
  textarea: 'Texto largo',
  select: 'Selección única',
  multiselect: 'Selección múltiple',
  boolean: 'Sí / No',
  number: 'Número',
  date: 'Fecha',
};

export function AddCensoFieldDialog({ existingKeys, onAdd, onClose }: Props) {
  const [tab, setTab] = useState<'palette' | 'custom'>('palette');

  const available: PredefinedFieldDefinition[] = useMemo(
    () => listPredefinedFields().filter((f) => !existingKeys.includes(f.key)),
    [existingKeys],
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Añadir campo al censo</h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b">
          <button
            onClick={() => setTab('palette')}
            className={`flex-1 py-3 text-sm font-medium ${
              tab === 'palette' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
            }`}
          >
            Predefinidos
          </button>
          <button
            onClick={() => setTab('custom')}
            className={`flex-1 py-3 text-sm font-medium ${
              tab === 'custom' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
            }`}
          >
            Personalizado
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'palette' ? (
            <PaletteTab available={available} onAdd={(f) => { onAdd(f); onClose(); }} />
          ) : (
            <CustomTab existingKeys={existingKeys} onAdd={(f) => { onAdd(f); onClose(); }} />
          )}
        </div>
      </div>
    </div>
  );
}

function PaletteTab({
  available,
  onAdd,
}: {
  available: PredefinedFieldDefinition[];
  onAdd: (field: ProfileFormField) => void;
}) {
  if (available.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">
        Ya has añadido todos los campos predefinidos disponibles.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {available.map((f) => (
        <li key={f.key}>
          <button
            onClick={() =>
              onAdd({
                source: 'predefined',
                key: f.key,
                required: false,
              })
            }
            className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition"
          >
            <div className="font-medium text-sm">{f.defaultLabel}</div>
            {f.description && (
              <div className="text-xs text-gray-500 mt-0.5">{f.description}</div>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function CustomTab({
  existingKeys,
  onAdd,
}: {
  existingKeys: string[];
  onAdd: (field: ProfileFormField) => void;
}) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FieldType>('text');
  const [optionsRaw, setOptionsRaw] = useState('');
  const [required, setRequired] = useState(false);
  const [error, setError] = useState('');

  const needsOptions = type === 'select' || type === 'multiselect';

  function handleAdd() {
    setError('');
    const trimmed = label.trim();
    if (!trimmed) {
      setError('La etiqueta es obligatoria.');
      return;
    }
    const key = slugifyFieldKey(trimmed);
    if (!key) {
      setError('La etiqueta debe contener letras o números.');
      return;
    }
    if (existingKeys.includes(key)) {
      setError(`Ya existe un campo con la clave "${key}".`);
      return;
    }
    let options: string[] | undefined;
    if (needsOptions) {
      options = optionsRaw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      if (options.length === 0) {
        setError('Debes proporcionar al menos una opción.');
        return;
      }
    }
    onAdd({
      source: 'custom',
      key,
      label: trimmed,
      type,
      options,
      required,
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Etiqueta</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          placeholder="¿Cuántos años llevas en el pueblo?"
        />
        {label && (
          <div className="text-xs text-gray-500 mt-1">
            Clave: <code className="font-mono">{slugifyFieldKey(label) || '(inválida)'}</code>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tipo</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as FieldType)}
          className="w-full px-3 py-2 border rounded-lg text-sm"
        >
          {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {needsOptions && (
        <div>
          <label className="block text-sm font-medium mb-1">Opciones (una por línea)</label>
          <textarea
            value={optionsRaw}
            onChange={(e) => setOptionsRaw(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
            rows={4}
            placeholder={'Sí\nNo\nQuizás'}
          />
        </div>
      )}

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        <span className="text-sm">Obligatorio para inscribirse a eventos</span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleAdd}
        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
      >
        Añadir campo
      </button>
    </div>
  );
}
