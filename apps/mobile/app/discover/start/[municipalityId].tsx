import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Screen,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Escudo,
  Pressable,
} from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { PhoneField } from '../../../components/feature/PhoneField';
import { useT } from '../../../lib/i18n';
import { useAuth } from '../../../lib/auth/useAuth';
import { useCallable } from '../../../lib/useCallable';
import { useOrganizerPhone } from '../../../lib/useOrganizerPhone';
import { pickImageAsBlob } from '../../../lib/images';
import {
  getMunicipality,
  startVillage,
} from '@cultuvilla/shared/services/municipalityService';
import { requestOrganizeVillage } from '@cultuvilla/shared/services/organizerRequestService';
import { patchUserProfile } from '@cultuvilla/shared/services/userService';
import { uploadMunicipalityImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import {
  escudoFullUrl,
  hasManualEscudo,
  type MunicipalityData,
} from '@cultuvilla/shared/models/municipality';

type Muni = MunicipalityData & { id: string };

/**
 * "Start this village" — self-service activation of a dormant municipality.
 * Activating it makes the village joinable and adds the starter as its first
 * member; it does NOT make them the organizer. The optional toggle files an
 * organizer request in the same flow (still superadmin-approved). When the
 * user opts to organize, we capture a contact phone (stored on their profile)
 * and their motivation. If the village has no escudo, the starter may
 * optionally upload one, which is set server-side during activation.
 */
export default function StartVillageScreen() {
  const { municipalityId } = useLocalSearchParams<{ municipalityId: string }>();
  const { t } = useT();
  const { user, profile } = useAuth();
  const organizerPhone = useOrganizerPhone(profile?.telephone);
  const [muni, setMuni] = useState<Muni | null>(null);
  const [wantOrganize, setWantOrganize] = useState(false);
  const [motivation, setMotivation] = useState('');
  const [escudoImage, setEscudoImage] = useState<UploadableImage | null>(null);

  useEffect(() => {
    if (!municipalityId) return;
    let cancelled = false;
    void getMunicipality(municipalityId)
      .then((m) => {
        if (cancelled) return;
        setMuni(m);
      })
      .catch((e) => console.log('[StartVillage] getMunicipality ERR', e?.code, e?.message));
    return () => {
      cancelled = true;
    };
  }, [municipalityId]);

  const existingEscudo = muni ? escudoFullUrl(muni) : null;

  async function pickEscudo() {
    const picked = await pickImageAsBlob({ square: true });
    if (picked) setEscudoImage(picked);
  }

  const { fire: submit, isPending } = useCallable({
    callable: async () => {
      const id = municipalityId ?? '';
      // Upload the optional escudo first so the URL can be set during activation.
      let escudoManualUrl: string | undefined;
      if (escudoImage && !existingEscudo) {
        escudoManualUrl = await uploadMunicipalityImage(id, escudoImage);
      }
      await startVillage({
        municipalityId: id,
        escudoManualUrl,
      });
      if (wantOrganize) {
        if (user) await patchUserProfile(user.uid, { telephone: organizerPhone.e164 });
        await requestOrganizeVillage({ municipalityId: id, motivation: motivation.trim() || null });
      }
    },
    onSuccess: () => {
      router.replace({
        pathname: '/village/[villageId]',
        params: { villageId: municipalityId ?? '' },
      });
    },
    swallow: true,
  });

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('start.title')} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <VStack gap={4}>
          <Text variant="bodySm">{t('start.explainer')}</Text>

          {/* Identity of the village being activated. */}
          <VStack gap={2} className="items-center">
            {existingEscudo ? (
              <Escudo
                url={existingEscudo}
                size={88}
                fill={muni ? hasManualEscudo(muni) : false}
                fallbackInitial={muni?.name}
              />
            ) : (
              <VStack gap={1} className="items-center">
                <Pressable
                  onPress={() => void pickEscudo()}
                  accessibilityLabel={escudoImage ? t('start.escudoSelected') : t('start.escudoAdd')}
                  className="self-center bg-surface rounded-2xl p-2"
                >
                  <Escudo
                    url={escudoImage?.previewUri ?? null}
                    size={88}
                    fill={escudoImage != null}
                    fallbackInitial={muni?.name}
                  />
                </Pressable>
                <Text tone="muted" variant="bodySm">
                  {escudoImage ? t('start.escudoSelected') : t('start.escudoAdd')}
                </Text>
              </VStack>
            )}
            {muni ? (
              <Text variant="h3">{muni.name}</Text>
            ) : (
              <ActivityIndicator />
            )}
          </VStack>

          <VStack gap={2}>
            <Text variant="bodySm">{t('start.organizeIntro')}</Text>
            <HStack gap={3} className="items-center justify-between">
              <Text className="flex-1">{t('start.organizeToggle')}</Text>
              <Switch value={wantOrganize} onValueChange={setWantOrganize} />
            </HStack>
          </VStack>

          {wantOrganize && (
            <>
              <PhoneField {...organizerPhone.fieldProps} />
              <Input
                label={t('requests.organizer.motivationLabel')}
                value={motivation}
                onChangeText={setMotivation}
                multiline
                numberOfLines={4}
              />
            </>
          )}

          <Button
            onPress={() => {
              if (!municipalityId) return;
              if (wantOrganize && !organizerPhone.validateForSubmit()) return;
              void submit();
            }}
            loading={isPending}
            disabled={!municipalityId}
            fullWidth
            testID="start-submit"
          >
            <Text tone="onAccent">{t('start.submit')}</Text>
          </Button>
        </VStack>
      </ScrollView>
    </Screen>
  );
}
