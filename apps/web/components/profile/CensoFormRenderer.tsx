'use client';

import { getPredefinedField } from '@cultuvilla/shared/models/municipality/profileFieldRegistry';
import type {
  ProfileFormField,
  ProfileAnswers,
  FieldType,
} from '@cultuvilla/shared/models/municipality/CensoTypes';

interface Props {
  fields: ProfileFormField[];
  answers: ProfileAnswers;
  onChange: (next: ProfileAnswers) => void;
  /** List of barrio names available to the "barrio" predefined field. */
  barrios: string[];
  disabled?: boolean;
}

interface Resolved {
  field: ProfileFormField;
  label: string;
  type: FieldType;
  options: string[] | undefined;
}

export function CensoFormRenderer({
  fields,
  answers,
  onChange,
  barrios,
  disabled,
}: Props) {
  if (fields.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">
        El coordinador del pueblo aún no ha definido un censo.
      </p>
    );
  }

  const resolved: Resolved[] = fields.map((f) => {
    if (f.source === 'custom') {
      return { field: f, label: f.label, type: f.type, options: f.options };
    }
    const def = getPredefinedField(f.key);
    const label = f.label ?? def?.defaultLabel ?? f.key;
    const type = (def?.type ?? 'text') as FieldType;
    const options = def?.optionsFromBarrios ? barrios : def?.options;
    return { field: f, label, type, options };
  });

  function set(key: string, value: ProfileAnswers[string] | undefined) {
    const next: ProfileAnswers = { ...answers };
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {resolved.map(({ field, label, type, options }) => {
        const id = `censo-${field.key}`;
        return (
          <div key={field.key}>
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
              {label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <FieldInput
              id={id}
              type={type}
              options={options}
              value={answers[field.key]}
              onChange={(v) => set(field.key, v)}
              disabled={disabled}
            />
          </div>
        );
      })}
    </div>
  );
}

interface FieldInputProps {
  id: string;
  type: FieldType;
  options: string[] | undefined;
  value: ProfileAnswers[string] | undefined;
  onChange: (v: ProfileAnswers[string] | undefined) => void;
  disabled?: boolean;
}

function FieldInput({ id, type, options, value, onChange, disabled }: FieldInputProps) {
  const baseClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60';

  if (type === 'text') {
    return (
      <input
        id={id}
        type="text"
        value={(value as string | undefined) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={baseClass}
        disabled={disabled}
      />
    );
  }
  if (type === 'textarea') {
    return (
      <textarea
        id={id}
        value={(value as string | undefined) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={baseClass}
        rows={3}
        disabled={disabled}
      />
    );
  }
  if (type === 'number') {
    return (
      <input
        id={id}
        type="number"
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className={baseClass}
        disabled={disabled}
      />
    );
  }
  if (type === 'date') {
    return (
      <input
        id={id}
        type="date"
        value={(value as string | undefined) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={baseClass}
        disabled={disabled}
      />
    );
  }
  if (type === 'boolean') {
    return (
      <select
        id={id}
        value={value === true ? 'true' : value === false ? 'false' : ''}
        onChange={(e) => {
          if (e.target.value === '') onChange(undefined);
          else onChange(e.target.value === 'true');
        }}
        className={baseClass}
        disabled={disabled}
      >
        <option value="">Selecciona…</option>
        <option value="true">Sí</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (type === 'select') {
    return (
      <select
        id={id}
        value={(value as string | undefined) ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={baseClass}
        disabled={disabled}
      >
        <option value="">Selecciona…</option>
        {(options ?? []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  if (type === 'multiselect') {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-wrap gap-2">
        {(options ?? []).map((o) => {
          const checked = arr.includes(o);
          return (
            <label
              key={o}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border cursor-pointer ${
                checked
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...arr, o]
                    : arr.filter((x) => x !== o);
                  onChange(next.length ? next : undefined);
                }}
                disabled={disabled}
                className="hidden"
              />
              {o}
            </label>
          );
        })}
      </div>
    );
  }
  return null;
}
