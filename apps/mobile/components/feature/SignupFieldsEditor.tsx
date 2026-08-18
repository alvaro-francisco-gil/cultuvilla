import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../primitives/Input';
import { Text } from '../primitives/Text';
import { VStack } from '../primitives/VStack';
import { HStack } from '../primitives/HStack';
import { Pressable } from '../primitives/Pressable';
import { Toggle } from '../primitives/Toggle';
import {
  MAX_SIGNUP_FIELDS,
  MAX_SIGNUP_FIELD_OPTIONS,
  makeSignupFieldId,
  type SignupFieldSpec,
  type SignupFieldType,
} from '@cultuvilla/shared/models/event/SignupFieldModel';
import { colors, iconSizes } from '@cultuvilla/shared/design-system';
import { useT } from '../../lib/i18n';

const FIELD_TYPES: SignupFieldType[] = ['text', 'number', 'date', 'select', 'checkbox'];

export interface SignupFieldsEditorProps {
  value: SignupFieldSpec[];
  onChange: (next: SignupFieldSpec[]) => void;
  /**
   * How many fields were already on the event when it last had a sign-up.
   * Those entries are frozen: answers are stored under their ids, so removing
   * or retyping one strands the data. Mirrors the rules-level size gate.
   */
  lockedCount?: number;
}

/**
 * Creator-side editor for an event's custom sign-up fields, shown next to the
 * telephone/payment toggles in the event form. Each row is one question the
 * attendee answers when they sign themselves (and their personas) up.
 */
export function SignupFieldsEditor({ value, onChange, lockedCount = 0 }: SignupFieldsEditorProps) {
  const { t } = useT();
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({});

  const patch = (index: number, changes: Partial<SignupFieldSpec>) => {
    onChange(value.map((f, i) => (i === index ? { ...f, ...changes } : f)));
  };

  const addField = () => {
    if (value.length >= MAX_SIGNUP_FIELDS) return;
    onChange([
      ...value,
      { id: makeSignupFieldId(), label: '', type: 'text', required: false, options: [] },
    ]);
  };

  const addOption = (index: number, field: SignupFieldSpec) => {
    const draft = (optionDrafts[field.id] ?? '').trim();
    if (!draft || field.options.length >= MAX_SIGNUP_FIELD_OPTIONS) return;
    if (field.options.includes(draft)) return;
    patch(index, { options: [...field.options, draft] });
    setOptionDrafts((prev) => ({ ...prev, [field.id]: '' }));
  };

  return (
    <VStack gap={3} className="pt-2">
      <Text variant="caption" tone="muted">
        {t('event.signupFields.title')}
      </Text>

      {value.map((field, index) => {
        const locked = index < lockedCount;
        return (
          <VStack key={field.id} gap={2} className="rounded-lg border border-subtle p-3">
            <HStack gap={2} align="center">
              <View className="flex-1">
                <Input
                  label={t('event.signupFields.label')}
                  value={field.label}
                  onChangeText={(label) => patch(index, { label })}
                  testID={`signup-field-label-${String(index)}`}
                />
              </View>
              {locked ? null : (
                <Pressable
                  testID={`signup-field-remove-${String(index)}`}
                  accessibilityLabel={t('common.delete')}
                  hitSlop={8}
                  onPress={() => onChange(value.filter((_, i) => i !== index))}
                >
                  <Ionicons name="trash-outline" size={iconSizes.md} color={colors.light.fg.danger} />
                </Pressable>
              )}
            </HStack>

            <View className="flex-row flex-wrap gap-2">
              {FIELD_TYPES.map((type) => {
                const active = field.type === type;
                return (
                  <Pressable
                    key={type}
                    testID={`signup-field-type-${String(index)}-${type}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active, disabled: locked }}
                    disabled={locked}
                    onPress={() => patch(index, { type, options: [] })}
                    className={`rounded-full border px-3 py-1 ${
                      active ? 'border-accent bg-surface' : 'border-subtle'
                    } ${locked && !active ? 'opacity-40' : ''}`}
                  >
                    <Text variant="caption" tone={active ? 'primary' : 'muted'}>
                      {t(`event.signupFields.type.${type}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {field.type === 'select' ? (
              <VStack gap={2}>
                <View className="flex-row flex-wrap gap-2">
                  {field.options.map((option) => (
                    <Pressable
                      key={option}
                      testID={`signup-field-option-${String(index)}-${option}`}
                      accessibilityLabel={`${t('common.delete')} ${option}`}
                      onPress={() =>
                        patch(index, { options: field.options.filter((o) => o !== option) })
                      }
                      className="flex-row items-center gap-1 rounded-full border border-subtle px-3 py-1"
                    >
                      <Text variant="caption" tone="muted">
                        {option}
                      </Text>
                      <Ionicons name="close" size={iconSizes.sm} color={colors.light.fg.muted} />
                    </Pressable>
                  ))}
                </View>
                <HStack gap={2} align="center">
                  <View className="flex-1">
                    <Input
                      value={optionDrafts[field.id] ?? ''}
                      onChangeText={(text) =>
                        setOptionDrafts((prev) => ({ ...prev, [field.id]: text }))
                      }
                      placeholder={t('event.signupFields.optionPlaceholder')}
                      onSubmitEditing={() => addOption(index, field)}
                      dense
                      testID={`signup-field-option-input-${String(index)}`}
                    />
                  </View>
                  <Pressable
                    testID={`signup-field-option-add-${String(index)}`}
                    accessibilityLabel={t('event.signupFields.addOption')}
                    onPress={() => addOption(index, field)}
                  >
                    <Ionicons name="add-circle-outline" size={iconSizes.md} color={colors.light.fg.accent} />
                  </Pressable>
                </HStack>
              </VStack>
            ) : null}

            <HStack className="items-center justify-between">
              <Text className="flex-1">{t('event.signupFields.required')}</Text>
              <Toggle
                value={field.required}
                onValueChange={(required) => patch(index, { required })}
                testID={`signup-field-required-${String(index)}`}
              />
            </HStack>
          </VStack>
        );
      })}

      {value.length < MAX_SIGNUP_FIELDS ? (
        <Pressable
          testID="signup-field-add"
          accessibilityRole="button"
          accessibilityLabel={t('event.signupFields.add')}
          onPress={addField}
          className="flex-row items-center gap-2 rounded-lg border border-dashed border-subtle p-3"
        >
          <Ionicons name="add" size={iconSizes.md} color={colors.light.fg.muted} />
          <Text tone="muted">{t('event.signupFields.add')}</Text>
        </Pressable>
      ) : null}

      {lockedCount > 0 ? (
        <Text variant="caption" tone="muted">
          {t('event.signupFields.lockedNotice')}
        </Text>
      ) : null}
    </VStack>
  );
}
