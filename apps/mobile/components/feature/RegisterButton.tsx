import { useState } from 'react';
import { Alert } from 'react-native';
import { Button } from '../primitives/Button';
import { registerToEvent } from '@cultuvilla/shared/services/registrationService';
import { useT } from '../../lib/i18n';

export interface RegisterButtonProps {
  eventId: string;
  personId: string;
  name: string;
  onRegistered: () => void;
}

/**
 * CTA button that calls the registerToEvent Cloud Function.
 * Requires personId + name — callers should fetch them via getPersonByUserId
 * before rendering this component.
 *
 * registerToEvent(eventId, registrants) — `registrants` is RegisterInput[]:
 *   { personId: string; name: string }
 */
export function RegisterButton({ eventId, personId, name, onRegistered }: RegisterButtonProps) {
  const { t } = useT();
  const [loading, setLoading] = useState(false);

  async function handlePress() {
    setLoading(true);
    try {
      await registerToEvent(eventId, [{ personId, name }]);
      onRegistered();
    } catch (e) {
      // mobile-web-compat: native-only — TODO: convert to web-aware showAlert when web users can register
      Alert.alert(t('event.register.error'), e instanceof Error ? e.message : 'unknown');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onPress={handlePress} loading={loading} fullWidth>
      {t('event.register.cta')}
    </Button>
  );
}
