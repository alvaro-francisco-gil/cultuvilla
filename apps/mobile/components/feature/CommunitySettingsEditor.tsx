import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VStack, Text, Button, Input, Pressable, Escudo } from '../primitives';
import { LocationPicker } from './LocationPicker';
import { useT } from '../../lib/i18n';
import { showAlert } from '../../lib/dialogs';
import { pickImageAsBlob } from '../../lib/images';
import {
  getMunicipality,
  updateCommunity,
  updateMunicipality,
} from '@cultuvilla/shared/services/municipalityService';
import { uploadMunicipalityImage } from '@cultuvilla/shared/services/imageService';
import { MAP_ZOOM_DEFAULT, clampMapZoom } from '@cultuvilla/shared/services/mapsService';
import {
  escudoFullUrl,
  hasManualEscudo,
} from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { LatLng } from '@cultuvilla/shared/models/core/LocationDataModel';

const ACCENT = '#bb5d3a';

/**
 * Organizer-only community editor (escudo, description, coordinates).
 * Content-only so it embeds in the shared community screen behind a role gate
 * (the "Detalles" tab), and in the legacy /admin/community wrapper.
 */
export function CommunitySettingsEditor({ villageId }: { villageId: string }) {
  const { t } = useT();
  const [village, setVillage] = useState<MunicipalityData | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [zoom, setZoom] = useState<number>(MAP_ZOOM_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [uploadingEscudo, setUploadingEscudo] = useState(false);

  const load = useCallback(async () => {
    if (!villageId) return;
    const m = await getMunicipality(villageId);
    setVillage(m);
    setDescription(m?.community?.description ?? '');
    setCoords(m?.coordinates ?? null);
    setZoom(clampMapZoom(m?.mapZoom ?? MAP_ZOOM_DEFAULT));
  }, [villageId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeEscudo() {
    if (!villageId) return;
    const picked = await pickImageAsBlob({ square: true });
    if (!picked) return;
    setUploadingEscudo(true);
    try {
      const url = await uploadMunicipalityImage(villageId, picked);
      await updateMunicipality(villageId, { escudoManualUrl: url });
      await load();
    } catch (e) {
      showAlert(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingEscudo(false);
    }
  }

  async function save() {
    if (!villageId || description === null) return;
    setSaving(true);
    try {
      await updateCommunity(villageId, { description });
      await updateMunicipality(villageId, {
        coordinates: coords,
        mapZoom: coords ? zoom : null,
      });
      showAlert(t('village.admin.community.saved'));
    } finally {
      setSaving(false);
    }
  }

  const hasEscudo = village ? escudoFullUrl(village) !== null : false;

  return (
    <ScrollView contentContainerClassName="p-4">
      <VStack gap={3}>
        <Text variant="h3">{t('village.admin.community.escudo')}</Text>
        <Pressable
          onPress={changeEscudo}
          disabled={uploadingEscudo}
          accessibilityLabel={hasEscudo ? t('village.escudo.change') : t('village.escudo.add')}
          className={`relative self-start bg-surface rounded-2xl shadow-sm ${
            village && hasManualEscudo(village) ? '' : 'p-2'
          }`}
        >
          <Escudo
            url={village ? escudoFullUrl(village) : null}
            size={88}
            fill={village ? hasManualEscudo(village) : false}
            fallbackInitial={village?.name}
          />
          <View className="absolute bottom-0 right-0 bg-surface rounded-full p-1 shadow-sm">
            <Ionicons name={hasEscudo ? 'camera' : 'add'} size={14} color={ACCENT} />
          </View>
          {uploadingEscudo ? (
            <View className="absolute inset-0 items-center justify-center rounded-2xl bg-black/30">
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
        </Pressable>

        <Text variant="h3" className="mt-2">{t('village.admin.community.description')}</Text>
        <Input value={description ?? ''} onChangeText={setDescription} multiline placeholder={t('village.admin.community.description')} />

        {/* Render only once loaded, so the picker seeds its state (and preview)
            from the saved coordinates instead of the pre-load null. */}
        {village ? (
          <LocationPicker value={coords} onChange={setCoords} zoom={zoom} onZoomChange={setZoom} showUseMyLocation={false} />
        ) : null}

        <Button onPress={save} loading={saving} disabled={uploadingEscudo}>
          {t('common.save')}
        </Button>
      </VStack>
    </ScrollView>
  );
}
