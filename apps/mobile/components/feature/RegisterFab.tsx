import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable as RNPressable, Text, View } from 'react-native';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { showAlert, showConfirm } from '../../lib/dialogs';
import {
  cancelRegistration,
  getUserRegistrations,
  registerToEvent,
} from '@cultuvilla/shared/services/registrationService';
import type { RegistrationStatus } from '@cultuvilla/shared/models/event/RegistrationDataModel';
import { useT } from '../../lib/i18n';

export interface RegisterFabProps {
  eventId: string;
  /** Firebase Auth uid — used to look up the caller's own registration. */
  userId: string;
  personId: string;
  name: string;
  /** When true, sign-up first prompts for a phone (stored organizer-only). */
  telephoneRequired: boolean;
}

/** The caller's current registration on this event, or null when not signed up. */
type MyRegistration = { id: string; status: RegistrationStatus } | null;

/**
 * Ordago-style floating sign-up button for the event detail screen. It reflects
 * the caller's live registration state in three shapes — not signed up,
 * confirmed, waitlisted — and toggles sign-up/cancel on tap (cancel goes through
 * a confirm dialog). For telephoneRequired events the tap opens a phone prompt
 * before registering.
 *
 * All visual styles live on `style` (never `className`) so the pill renders on
 * the RN-Web build, mirroring the Fab primitive.
 */
export function RegisterFab({ eventId, userId, personId, name, telephoneRequired }: RegisterFabProps) {
  const { t } = useT();
  const [registration, setRegistration] = useState<MyRegistration>(null);
  const [busy, setBusy] = useState(false);
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [phone, setPhone] = useState('');

  // Load the caller's existing registration so the button shows the true state
  // on a fresh page load, not just after an in-session sign-up.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const mine = await getUserRegistrations(eventId, userId);
      if (cancelled) return;
      const first = mine[0];
      setRegistration(first ? { id: first.id, status: first.status } : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, userId]);

  async function doRegister(withPhone?: string) {
    setBusy(true);
    try {
      const [summary] = await registerToEvent(eventId, [
        { personId, name, ...(withPhone ? { phone: withPhone } : {}) },
      ]);
      if (!summary) throw new Error('no-registration-returned');
      setRegistration({ id: summary.id, status: summary.status });
      setPhoneVisible(false);
      setPhone('');
    } catch (e) {
      showAlert(e instanceof Error ? e.message : 'unknown', t('event.register.error'));
    } finally {
      setBusy(false);
    }
  }

  async function doCancel(regId: string) {
    setBusy(true);
    try {
      await cancelRegistration(eventId, regId);
      setRegistration(null);
    } catch (e) {
      showAlert(e instanceof Error ? e.message : 'unknown', t('event.register.error'));
    } finally {
      setBusy(false);
    }
  }

  function handlePress() {
    if (busy) return;
    if (registration) {
      showConfirm(t('event.register.cancelTitle'), t('event.register.cancelBody'), () => void doCancel(registration.id), {
        confirmText: t('event.register.cancelConfirm'),
        cancelText: t('common.cancel'),
      });
      return;
    }
    if (telephoneRequired) {
      setPhoneVisible(true);
      return;
    }
    void doRegister();
  }

  const view = (() => {
    if (!registration) return { label: t('event.register.cta'), prefix: '+', bg: '#bb5d3a' };
    if (registration.status === 'waitlisted') return { label: t('event.register.waitlisted'), prefix: '⏳', bg: '#b07a1e' };
    return { label: t('event.register.signedUp'), prefix: '✓', bg: '#2f7d4f' };
  })();

  return (
    <>
      <Animated.View
        pointerEvents="box-none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center', zIndex: 20 }}
      >
        <RNPressable
          onPress={handlePress}
          disabled={busy}
          testID="register-fab"
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, selected: registration !== null }}
          accessibilityLabel={view.label}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            paddingHorizontal: 22,
            borderRadius: 999,
            backgroundColor: view.bg,
            opacity: busy ? 0.7 : 1,
            elevation: 6,
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
          }}
        >
          {busy ? (
            <ActivityIndicator color="#f9f0e8" style={{ marginRight: 8 }} />
          ) : (
            <Text style={{ color: '#f9f0e8', fontSize: 18, lineHeight: 22, marginRight: 8 }}>{view.prefix}</Text>
          )}
          <Text style={{ color: '#f9f0e8', fontSize: 16, fontWeight: '700' }}>{view.label}</Text>
        </RNPressable>
      </Animated.View>

      <Modal
        visible={phoneVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setPhoneVisible(false);
        }}
      >
        <RNPressable
          onPress={() => {
            if (!busy) setPhoneVisible(false);
          }}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          className="items-center justify-center px-8"
        >
          {/* Inner catcher: taps inside the card must not dismiss. */}
          <RNPressable onPress={() => {}} className="w-full rounded-lg bg-surface-elevated p-5 border border-subtle">
            <View>
              <Input
                label={t('event.register.phoneTitle')}
                value={phone}
                onChangeText={setPhone}
                placeholder={t('event.register.phonePlaceholder')}
                keyboardType="phone-pad"
                testID="register-fab-phone"
              />
              <View style={{ height: 12 }} />
              <Button
                onPress={() => void doRegister(phone.trim())}
                loading={busy}
                disabled={!phone.trim()}
                fullWidth
                testID="register-fab-phone-submit"
              >
                {t('event.register.cta')}
              </Button>
            </View>
          </RNPressable>
        </RNPressable>
      </Modal>
    </>
  );
}
