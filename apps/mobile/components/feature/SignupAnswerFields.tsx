import { View } from 'react-native';
import { Input } from '../primitives/Input';
import { Text } from '../primitives/Text';
import { VStack } from '../primitives/VStack';
import { Pressable } from '../primitives/Pressable';
import { Checkbox } from '../primitives/Checkbox';
import { DateField } from '../primitives/DateField';
import type {
  SignupAnswerValue,
  SignupFieldSpec,
} from '@cultuvilla/shared/models/event/SignupFieldModel';
import { useT } from '../../lib/i18n';

export interface SignupAnswerFieldsProps {
  fields: SignupFieldSpec[];
  values: Record<string, SignupAnswerValue>;
  onChange: (fieldId: string, value: SignupAnswerValue) => void;
  /** Field ids to mark in error — set once the user has attempted to confirm. */
  invalidIds?: string[];
  /** Namespaces the testIDs so several attendees' groups stay addressable. */
  testIDPrefix: string;
}

/**
 * The attendee-facing inputs for one event's custom sign-up fields, rendered
 * once per ticked persona (each attendee answers for themselves — a DNI or a
 * t-shirt size is per person, unlike the event's single shared phone).
 *
 * `select` renders as inline chips rather than a picker modal: this group lives
 * inside the AttendeeSheet, which is already a Modal, and nesting Modals is a
 * known RN-Web hazard (see the mobile-web-compat skill).
 */
export function SignupAnswerFields({
  fields,
  values,
  onChange,
  invalidIds = [],
  testIDPrefix,
}: SignupAnswerFieldsProps) {
  const { t } = useT();
  const invalid = new Set(invalidIds);

  if (fields.length === 0) return null;

  return (
    <VStack gap={3} className="pl-8 pt-2">
      {fields.map((field) => {
        const value = values[field.id];
        const isInvalid = invalid.has(field.id);
        const label = field.required ? `${field.label} *` : field.label;
        const testID = `${testIDPrefix}-${field.id}`;
        const errorText = isInvalid ? t('event.register.answerRequired') : undefined;

        switch (field.type) {
          case 'text':
          case 'number':
            return (
              <Input
                key={field.id}
                label={label}
                value={value === undefined ? '' : String(value)}
                onChangeText={(text) => onChange(field.id, text)}
                keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                error={errorText}
                testID={testID}
              />
            );

          case 'date':
            return (
              <VStack key={field.id} gap={1}>
                <DateField
                  label={label}
                  value={typeof value === 'string' && value ? new Date(value) : null}
                  onChange={(date) => onChange(field.id, date ? toISODate(date) : '')}
                  testID={testID}
                />
                {errorText ? (
                  <Text variant="caption" tone="danger">
                    {errorText}
                  </Text>
                ) : null}
              </VStack>
            );

          case 'select':
            return (
              <VStack key={field.id} gap={1}>
                <Text variant="caption" tone={isInvalid ? 'danger' : 'muted'}>
                  {label}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {field.options.map((option) => {
                    const active = value === option;
                    return (
                      <Pressable
                        key={option}
                        testID={`${testID}-${option}`}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        onPress={() => onChange(field.id, option)}
                        className={`rounded-full border px-3 py-1 ${
                          active ? 'border-accent bg-surface' : 'border-subtle'
                        }`}
                      >
                        <Text variant="caption" tone={active ? 'primary' : 'muted'}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {errorText ? (
                  <Text variant="caption" tone="danger">
                    {errorText}
                  </Text>
                ) : null}
              </VStack>
            );

          case 'checkbox':
            return (
              <VStack key={field.id} gap={1}>
                <Checkbox
                  value={value === true}
                  onValueChange={(next) => onChange(field.id, next)}
                  label={label}
                  testID={testID}
                />
                {errorText ? (
                  <Text variant="caption" tone="danger">
                    {errorText}
                  </Text>
                ) : null}
              </VStack>
            );
        }
      })}
    </VStack>
  );
}

/** Answers store a plain calendar day, not an instant — no timezone shifting. */
function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}
