import type { FieldType, OptionsSource, ProfileFormField } from '../models/municipality/CensoTypes';
import { getPredefinedField } from '../models/municipality/profileFieldRegistry';

export interface ResolvedField {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  optionsSource?: OptionsSource;
  required: boolean;
}

/**
 * Flattens a predefined-or-custom field into the shape the form/builder render.
 * Predefined fields carry only {source,key,label?,required}; their type/options
 * live in the registry. The barrio field's optionsFromBarrios maps to the
 * 'barrios' dynamic source.
 */
export function resolveFieldDisplay(field: ProfileFormField): ResolvedField {
  if (field.source === 'custom') {
    return {
      key: field.key,
      label: field.label,
      type: field.type,
      options: field.options,
      optionsSource: field.optionsSource,
      required: field.required,
    };
  }
  const def = getPredefinedField(field.key);
  return {
    key: field.key,
    label: field.label ?? def?.defaultLabel ?? field.key,
    type: def?.type ?? 'text',
    options: def?.options,
    optionsSource: def?.optionsFromBarrios ? 'barrios' : undefined,
    required: field.required,
  };
}
