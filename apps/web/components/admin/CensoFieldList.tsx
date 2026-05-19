'use client';

import { getPredefinedField } from '@cultuvilla/shared/models/municipality/profileFieldRegistry';
import type {
  ProfileFormField,
  FieldType,
} from '@cultuvilla/shared/models/municipality/CensoTypes';
import { ArrowUp, ArrowDown, Trash2, Lock } from 'lucide-react';

interface Props {
  fields: ProfileFormField[];
  lockedKeys: Set<string>;
  onChange: (fields: ProfileFormField[]) => void;
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Texto',
  textarea: 'Texto largo',
  select: 'Selección',
  multiselect: 'Selección múltiple',
  boolean: 'Sí / No',
  number: 'Número',
  date: 'Fecha',
};

export function CensoFieldList({ fields, lockedKeys, onChange }: Props) {
  if (fields.length === 0) {
    return (
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-sm text-gray-500">
        El censo está vacío. Añade un campo para empezar.
      </div>
    );
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function remove(index: number) {
    const next = fields.filter((_, i) => i !== index);
    onChange(next);
  }

  function toggleRequired(index: number) {
    const next = fields.map((f, i) => (i === index ? { ...f, required: !f.required } : f));
    onChange(next);
  }

  function updateLabel(index: number, label: string) {
    const next = fields.map((f, i) => {
      if (i !== index) return f;
      if (f.source === 'predefined') return { ...f, label };
      return { ...f, label };
    });
    onChange(next);
  }

  return (
    <ul className="space-y-2">
      {fields.map((f, i) => {
        const locked = lockedKeys.has(f.key);
        const displayLabel = displayLabelFor(f);
        const typeLabel = typeLabelFor(f);
        return (
          <li key={f.key} className="border rounded-xl p-3 bg-white">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={displayLabel}
                    onChange={(e) => updateLabel(i, e.target.value)}
                    className="font-medium text-sm bg-transparent border-b border-transparent focus:border-blue-400 outline-none flex-1 min-w-0"
                  />
                  {locked && <Lock size={14} className="text-gray-400 shrink-0" />}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  <span className="font-mono">{f.key}</span> · {typeLabel}
                  {f.source === 'predefined' && ' · predefinido'}
                </div>
                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={() => toggleRequired(i)}
                  />
                  <span className="text-xs">Obligatorio</span>
                </label>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                  aria-label="Subir"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === fields.length - 1}
                  className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                  aria-label="Bajar"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  onClick={() => remove(i)}
                  disabled={locked}
                  className="p-1 text-red-500 hover:text-red-700 disabled:opacity-30"
                  aria-label="Eliminar"
                  title={locked ? 'No se puede eliminar — hay miembros que ya han respondido' : 'Eliminar'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function displayLabelFor(f: ProfileFormField): string {
  if (f.source === 'custom') return f.label;
  return f.label ?? getPredefinedField(f.key)?.defaultLabel ?? f.key;
}

function typeLabelFor(f: ProfileFormField): string {
  if (f.source === 'custom') return FIELD_TYPE_LABELS[f.type];
  const def = getPredefinedField(f.key);
  return def ? FIELD_TYPE_LABELS[def.type] : '';
}
