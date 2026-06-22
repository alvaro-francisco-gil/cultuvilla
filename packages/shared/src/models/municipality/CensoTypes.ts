import { z } from 'zod';

export const FieldTypeSchema = z.enum([
  'text',
  'textarea',
  'select',
  'multiselect',
  'boolean',
  'number',
  'date',
]);
export type FieldType = z.infer<typeof FieldTypeSchema>;

export const PredefinedProfileFormFieldSchema = z.object({
  source: z.literal('predefined'),
  key: z.string(),
  label: z.string().optional(),
  required: z.boolean(),
});
export type PredefinedProfileFormField = z.infer<typeof PredefinedProfileFormFieldSchema>;

export const OptionsSourceSchema = z.enum(['barrios', 'places', 'organizations']);
export type OptionsSource = z.infer<typeof OptionsSourceSchema>;

export const CustomProfileFormFieldSchema = z.object({
  source: z.literal('custom'),
  key: z.string(),
  label: z.string(),
  type: FieldTypeSchema,
  options: z.array(z.string()).optional(),
  optionsSource: OptionsSourceSchema.optional(),
  required: z.boolean(),
});
export type CustomProfileFormField = z.infer<typeof CustomProfileFormFieldSchema>;

export const ProfileFormFieldSchema = z.discriminatedUnion('source', [
  PredefinedProfileFormFieldSchema,
  CustomProfileFormFieldSchema,
]);
export type ProfileFormField = z.infer<typeof ProfileFormFieldSchema>;

export const VillageProfileFormSchema = z.object({
  fields: z.array(ProfileFormFieldSchema),
  updatedAt: z.date(),
});
export type VillageProfileForm = z.infer<typeof VillageProfileFormSchema>;

export const ProfileAnswerValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);
export type ProfileAnswerValue = z.infer<typeof ProfileAnswerValueSchema>;

export const ProfileAnswersSchema = z.record(z.string(), ProfileAnswerValueSchema);
export type ProfileAnswers = z.infer<typeof ProfileAnswersSchema>;

export function slugifyFieldKey(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}
