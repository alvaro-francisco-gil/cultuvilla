import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { VStack } from '../primitives/VStack';
import { HStack } from '../primitives/HStack';
import { FieldLabel } from '../primitives/FieldLabel';
import { PHONE_COUNTRIES, flagEmoji, type PhoneCountry } from '@cultuvilla/shared/utils';

export interface PhoneFieldProps {
  label?: string;
  placeholder?: string;
  /** The national part of the number (everything after the dial code). */
  value: string;
  onChangeText: (next: string) => void;
  /** Selected country / dial code. Default should be `DEFAULT_PHONE_COUNTRY`. */
  country: PhoneCountry;
  onCountryChange: (next: PhoneCountry) => void;
  error?: string;
  testID?: string;
}

/**
 * Phone input with a country-prefix selector. The prefix drives validation
 * (see `isValidPhoneNumber`), so it's a first-class control rather than free
 * text. The country list expands inline instead of in a nested Modal — nested
 * Modals misbehave on the RN-Web build (see the `mobile-web-compat` skill).
 */
export function PhoneField({
  label,
  placeholder,
  value,
  onChangeText,
  country,
  onCountryChange,
  error,
  testID,
}: PhoneFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const borderClass = error ? 'border-danger' : 'border-subtle';

  return (
    <VStack gap={1}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <HStack gap={2} className="items-center">
        <Pressable
          onPress={() => setPickerOpen((o) => !o)}
          testID={testID ? `${testID}-prefix` : undefined}
          accessibilityRole="button"
          accessibilityState={{ expanded: pickerOpen }}
          className={`border rounded-md px-3 py-2 bg-surface ${borderClass}`}
        >
          <HStack gap={1} className="items-center">
            <Text>{flagEmoji(country.code)}</Text>
            <Text className="text-primary text-body">{country.dialCode}</Text>
            <Text tone="muted">▾</Text>
          </HStack>
        </Pressable>
        <View className={`flex-1 flex-row items-center border rounded-md px-3 py-2 bg-surface ${borderClass}`}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            keyboardType="phone-pad"
            accessibilityLabel={label ?? placeholder}
            className="flex-1 text-primary text-body"
            textAlignVertical="center"
            testID={testID}
          />
        </View>
      </HStack>

      {pickerOpen && (
        <VStack gap={1} className="border border-subtle rounded-md bg-surface p-1">
          {PHONE_COUNTRIES.map((c) => (
            <Pressable
              key={c.code}
              onPress={() => {
                onCountryChange(c);
                setPickerOpen(false);
              }}
              testID={testID ? `${testID}-option-${c.code}` : undefined}
              accessibilityRole="button"
              accessibilityState={{ selected: c.code === country.code }}
              className={`rounded-md px-3 py-2 ${c.code === country.code ? 'bg-surface-elevated' : ''}`}
            >
              <HStack gap={2} className="items-center">
                <Text>{flagEmoji(c.code)}</Text>
                <Text className="flex-1 text-primary">{c.name}</Text>
                <Text tone="muted">{c.dialCode}</Text>
              </HStack>
            </Pressable>
          ))}
        </VStack>
      )}

      {error && (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      )}
    </VStack>
  );
}
