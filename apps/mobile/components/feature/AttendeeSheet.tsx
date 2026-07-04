import { useEffect, useState } from 'react';
import { Modal, Pressable as RNPressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../primitives/Button';
import { Text } from '../primitives/Text';
import { VStack } from '../primitives/VStack';
import { HStack } from '../primitives/HStack';
import { PhoneField } from './PhoneField';
import type { RegistrationStatus } from '@cultuvilla/shared/models/event/RegistrationDataModel';
import {
  DEFAULT_PHONE_COUNTRY,
  formatPhoneE164,
  isValidPhoneNumber,
  type PhoneCountry,
} from '@cultuvilla/shared/utils';
import { useT } from '../../lib/i18n';

export interface AttendeeOption {
  id: string;
  name: string;
  /** Present when this persona is already registered on the event. */
  status?: RegistrationStatus;
}

export interface AttendeeSheetProps {
  visible: boolean;
  /** The user's personas — own persona first, then personas a cargo. */
  attendees: AttendeeOption[];
  telephoneRequired: boolean;
  busy: boolean;
  /** Personas to pre-tick (e.g. a dependent just created via onCreateNew). */
  autoSelectIds?: string[];
  onClose: () => void;
  onCreateNew: () => void;
  /** Reports the ticked persona ids (in attendee order) and the shared phone. */
  onConfirm: (selectedIds: string[], phone?: string) => void;
}

/**
 * Bottom-modal attendee picker for event sign-up. Lists the caller's personas,
 * pre-ticking whoever is already registered, and lets them add personas a cargo
 * (or create a new one). Confirm reports the ticked set; the parent diffs it
 * against the registered set to decide what to register vs cancel.
 *
 * Styles live on `style`/`className` per the existing modal pattern; the Modal
 * + window-confirm fallbacks keep it working on the RN-Web build.
 */
export function AttendeeSheet({
  visible,
  attendees,
  telephoneRequired,
  busy,
  autoSelectIds,
  onClose,
  onCreateNew,
  onConfirm,
}: AttendeeSheetProps) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>(DEFAULT_PHONE_COUNTRY);
  // Whether the user has pressed Confirmar at least once. The invalid-phone
  // error stays hidden until then — validating on every keystroke nags before
  // the user has finished typing.
  const [confirmAttempted, setConfirmAttempted] = useState(false);

  const registeredIds = new Set(attendees.filter((a) => a.status).map((a) => a.id));

  // Each time the sheet opens, seed the ticks with whoever is already
  // registered so the user starts from the current state.
  useEffect(() => {
    if (visible) {
      setSelected(new Set(attendees.filter((a) => a.status).map((a) => a.id)));
      setPhone('');
      setPhoneCountry(DEFAULT_PHONE_COUNTRY);
      setConfirmAttempted(false);
    }
    // attendees identity intentionally excluded — re-seed only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Merge in any auto-select ids (a freshly created dependent returning from
  // /person/new) without clearing the user's existing ticks.
  const autoKey = (autoSelectIds ?? []).join(',');
  useEffect(() => {
    if (!autoSelectIds || autoSelectIds.length === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      autoSelectIds.forEach((id) => next.add(id));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedInOrder = attendees.filter((a) => selected.has(a.id)).map((a) => a.id);
  const hasNewSelection = selectedInOrder.some((id) => !registeredIds.has(id));
  const changed =
    selected.size !== registeredIds.size || selectedInOrder.some((id) => !registeredIds.has(id));
  const needsPhone = telephoneRequired && hasNewSelection;
  const phoneValid = isValidPhoneNumber(phone, phoneCountry.dialCode);
  // The button gates on the selection change, NOT on phone validity — an
  // invalid phone must still let the press through so it can surface the error.
  const canConfirm = changed && !busy;
  // Show the invalid-phone error only after a confirm attempt (not per keystroke).
  const phoneError = confirmAttempted && needsPhone && !phoneValid;

  function handleConfirm() {
    if (!canConfirm) return;
    if (needsPhone && !phoneValid) {
      setConfirmAttempted(true);
      return;
    }
    onConfirm(selectedInOrder, needsPhone ? formatPhoneE164(phone, phoneCountry.dialCode) : undefined);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <RNPressable
        onPress={() => {
          if (!busy) onClose();
        }}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        className="justify-end"
      >
        {/* Inner catcher: taps inside the card must not dismiss. Pad the bottom
            by the safe-area inset so the confirm button clears the home
            indicator / nav bar. */}
        <RNPressable
          onPress={() => {}}
          className="rounded-t-2xl bg-surface-elevated p-5 border-t border-subtle"
          style={{ paddingBottom: insets.bottom + 20 }}
        >
          <VStack gap={3}>
            <Text variant="h3">{t('event.register.attendeesTitle')}</Text>

            <ScrollView style={{ maxHeight: 320 }}>
              <VStack gap={2}>
                {attendees.map((a) => {
                  const isSelected = selected.has(a.id);
                  return (
                    <RNPressable
                      key={a.id}
                      testID={`attendee-row-${a.id}`}
                      onPress={() => toggle(a.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                      className={`flex-row items-center justify-between rounded-lg border p-3 ${
                        isSelected ? 'border-accent bg-surface' : 'border-subtle'
                      }`}
                    >
                      <HStack gap={3} className="items-center flex-1">
                        <Text style={{ fontSize: 18 }}>{isSelected ? '☑' : '☐'}</Text>
                        <Text className="flex-1">{a.name}</Text>
                      </HStack>
                      {a.status ? (
                        <Text tone={a.status === 'waitlisted' ? 'muted' : 'success'} variant="caption">
                          {a.status === 'waitlisted'
                            ? t('event.register.waitlisted')
                            : t('event.register.signedUp')}
                        </Text>
                      ) : null}
                    </RNPressable>
                  );
                })}

                {/* Same rectangle shape as a persona row, but a dashed outline
                    and a + to read as "add another". */}
                <RNPressable
                  onPress={onCreateNew}
                  testID="attendee-create"
                  accessibilityRole="button"
                  accessibilityLabel={t('event.register.createPersona')}
                  className="flex-row items-center rounded-lg border border-dashed border-subtle p-3"
                >
                  <HStack gap={3} className="items-center flex-1">
                    <Text tone="muted" style={{ fontSize: 18 }}>
                      ＋
                    </Text>
                    <Text tone="muted" className="flex-1">
                      {t('event.register.createPersona')}
                    </Text>
                  </HStack>
                </RNPressable>
              </VStack>
            </ScrollView>

            {needsPhone ? (
              <PhoneField
                label={t('event.register.phoneTitle')}
                value={phone}
                onChangeText={setPhone}
                country={phoneCountry}
                onCountryChange={setPhoneCountry}
                placeholder={t('event.register.phonePlaceholder')}
                searchPlaceholder={t('event.register.phoneSearch')}
                noResultsLabel={t('event.register.phoneNoResults')}
                error={phoneError ? t('event.register.phoneInvalid') : undefined}
                testID="attendee-phone"
              />
            ) : null}

            <Button
              onPress={handleConfirm}
              loading={busy}
              disabled={!canConfirm}
              fullWidth
              testID="attendee-confirm"
            >
              {t('event.register.confirm')}
            </Button>
          </VStack>
        </RNPressable>
      </RNPressable>
    </Modal>
  );
}
