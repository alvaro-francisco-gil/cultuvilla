// Pure validators for the village censo profile form.
// No Firestore access — collectUsedValues stays in updateCenso.ts.

import { HttpsError } from 'firebase-functions/v2/https';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'number'
  | 'date';

export interface PredefinedField {
  source: 'predefined';
  key: string;
  label?: string;
  required: boolean;
}

export interface CustomField {
  source: 'custom';
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  optionsSource?: 'barrios' | 'places' | 'organizations';
  required: boolean;
}

export type ProfileFormField = PredefinedField | CustomField;

export interface PrevField {
  source: 'predefined' | 'custom';
  key: string;
  type?: FieldType;
  options?: string[];
  optionsSource?: 'barrios' | 'places' | 'organizations';
}

export interface UsedValuesByKey {
  [key: string]: Set<string | number | boolean>;
}

export const PREDEFINED_KEYS = new Set([
  'barrio',
  'residencyType',
  'householdSize',
  'hasMinors',
  'arrivalYear',
  'originVillage',
]);

const VALID_OPTION_SOURCES = new Set(['barrios', 'places', 'organizations']);

const VALID_FIELD_TYPES = new Set<FieldType>([
  'text',
  'textarea',
  'select',
  'multiselect',
  'boolean',
  'number',
  'date',
]);

const CUSTOM_KEY_RE = /^[a-z0-9_]{1,40}$/;

export function ensureValidFieldShape(f: unknown): asserts f is ProfileFormField {
  if (!f || typeof f !== 'object') throw new HttpsError('invalid-argument', 'Campo inválido.');
  const r = f as Partial<ProfileFormField>;
  if (r.source !== 'predefined' && r.source !== 'custom') {
    throw new HttpsError('invalid-argument', 'source debe ser predefined o custom.');
  }
  if (typeof r.key !== 'string' || !r.key) {
    throw new HttpsError('invalid-argument', 'key requerida.');
  }
  if (typeof r.required !== 'boolean') {
    throw new HttpsError('invalid-argument', 'required debe ser boolean.');
  }
  if (r.source === 'predefined') {
    if (!PREDEFINED_KEYS.has(r.key)) {
      throw new HttpsError('invalid-argument', `Campo predefinido desconocido: ${r.key}`);
    }
    return;
  }
  const c = r as Partial<CustomField>;
  if (typeof c.label !== 'string' || !c.label.trim()) {
    throw new HttpsError('invalid-argument', 'label requerida en campos custom.');
  }
  if (!c.type || !VALID_FIELD_TYPES.has(c.type)) {
    throw new HttpsError('invalid-argument', `Tipo inválido: ${String(c.type)}`);
  }
  if (!CUSTOM_KEY_RE.test(c.key as string)) {
    throw new HttpsError('invalid-argument', `Clave personalizada inválida: ${String(c.key)}`);
  }
  const isChoice = c.type === 'select' || c.type === 'multiselect';
  const hasStatic = Array.isArray(c.options) && c.options.length > 0;
  const hasSource = c.optionsSource !== undefined;
  if (hasSource && !VALID_OPTION_SOURCES.has(c.optionsSource as string)) {
    throw new HttpsError('invalid-argument', `optionsSource inválido: ${String(c.optionsSource)}`);
  }
  if (hasSource && !isChoice) {
    throw new HttpsError('invalid-argument', `optionsSource solo válido en select/multiselect.`);
  }
  if (isChoice) {
    if (hasStatic && hasSource) {
      throw new HttpsError('invalid-argument', `El campo ${String(c.key)} no puede tener opciones y optionsSource a la vez.`);
    }
    if (!hasStatic && !hasSource) {
      throw new HttpsError('invalid-argument', `El campo ${String(c.key)} requiere opciones.`);
    }
  }
}

export function validateTransition(
  prev: PrevField[],
  next: ProfileFormField[],
  used: UsedValuesByKey,
): void {
  const seen = new Set<string>();
  for (const f of next) {
    if (seen.has(f.key)) {
      throw new HttpsError('failed-precondition', `Clave duplicada: ${f.key}`);
    }
    seen.add(f.key);
  }

  const nextByKey = new Map(next.map((f) => [f.key, f]));
  for (const prevField of prev) {
    const nextField = nextByKey.get(prevField.key);
    if (!nextField) {
      // Index signature returns Set<...> (no `| undefined`) under current
      // tsconfig (noUncheckedIndexedAccess=false), so the key may be missing
      // at runtime even though TS doesn't admit it. Guard with `in`.
      const hasAnswers = prevField.key in used && used[prevField.key].size > 0;
      if (hasAnswers) {
        throw new HttpsError(
          'failed-precondition',
          `No se puede eliminar el campo "${prevField.key}" porque ya hay miembros que han respondido.`,
        );
      }
      continue;
    }
    if (prevField.source !== nextField.source) {
      throw new HttpsError(
        'failed-precondition',
        `No se puede cambiar el origen del campo "${prevField.key}".`,
      );
    }
    if (prevField.source === 'custom' && nextField.source === 'custom') {
      if (prevField.type && prevField.type !== nextField.type) {
        throw new HttpsError(
          'failed-precondition',
          `No se puede cambiar el tipo del campo "${prevField.key}".`,
        );
      }
      if (nextField.optionsSource === undefined && (prevField as CustomField).optionsSource === undefined) {
        const prevOpts = new Set(prevField.options ?? []);
        const nextOpts = new Set(nextField.options ?? []);
        const removed = [...prevOpts].filter((o) => !nextOpts.has(o));
        const usedValues = used[prevField.key] ?? new Set();
        for (const r of removed) {
          if (usedValues.has(r)) {
            throw new HttpsError(
              'failed-precondition',
              `No se puede eliminar la opción "${r}" del campo "${prevField.key}" porque ya está en uso.`,
            );
          }
        }
      }
    }
  }
}
