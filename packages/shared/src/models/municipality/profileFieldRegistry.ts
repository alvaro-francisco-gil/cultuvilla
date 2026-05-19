import type { FieldType } from './CensoTypes';

export interface PredefinedFieldDefinition {
  key: string;
  defaultLabel: string;
  type: FieldType;
  options?: string[];
  optionsFromBarrios?: boolean;
  description?: string;
}

export const PREDEFINED_FIELDS: Record<string, PredefinedFieldDefinition> = {
  barrio: {
    key: 'barrio',
    defaultLabel: 'Barrio',
    type: 'select',
    optionsFromBarrios: true,
    description: 'Barrio donde vive el miembro',
  },
  residencyType: {
    key: 'residencyType',
    defaultLabel: 'Tipo de residencia',
    type: 'select',
    options: ['permanente', 'veraneante', 'visitante'],
    description: 'Si vive en el pueblo todo el año, sólo en verano, etc.',
  },
  householdSize: {
    key: 'householdSize',
    defaultLabel: 'Personas en el hogar',
    type: 'number',
    description: 'Número de personas que viven en el hogar',
  },
  hasMinors: {
    key: 'hasMinors',
    defaultLabel: '¿Hay menores en el hogar?',
    type: 'boolean',
  },
  arrivalYear: {
    key: 'arrivalYear',
    defaultLabel: 'Año de llegada al pueblo',
    type: 'number',
  },
  originVillage: {
    key: 'originVillage',
    defaultLabel: 'Pueblo de origen',
    type: 'text',
  },
};

export type PredefinedFieldKey = keyof typeof PREDEFINED_FIELDS;

export function isPredefinedFieldKey(key: string): key is PredefinedFieldKey {
  return key in PREDEFINED_FIELDS;
}

export function getPredefinedField(key: string): PredefinedFieldDefinition | null {
  return PREDEFINED_FIELDS[key] ?? null;
}

export function listPredefinedFields(): PredefinedFieldDefinition[] {
  return Object.values(PREDEFINED_FIELDS);
}
