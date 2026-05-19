export type FieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'number'
  | 'date';

export interface PredefinedProfileFormField {
  source: 'predefined';
  key: string;
  label?: string;
  required: boolean;
}

export interface CustomProfileFormField {
  source: 'custom';
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required: boolean;
}

export type ProfileFormField = PredefinedProfileFormField | CustomProfileFormField;

export interface VillageProfileForm {
  fields: ProfileFormField[];
  updatedAt: Date;
}

export type ProfileAnswerValue = string | number | boolean | string[];
export type ProfileAnswers = Record<string, ProfileAnswerValue>;

export function slugifyFieldKey(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}
