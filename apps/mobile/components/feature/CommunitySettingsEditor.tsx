import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VStack, HStack, Text, Button, Input, Pressable, Escudo } from '../primitives';
import { useT } from '../../lib/i18n';
import { showAlert } from '../../lib/dialogs';
import { pickImageAsBlob } from '../../lib/images';
import {
  getMunicipality,
  updateCommunity,
  updateMunicipality,
} from '@cultuvilla/shared/services/municipalityService';
import { uploadMunicipalityImage } from '@cultuvilla/shared/services/imageService';
import {
  escudoFullUrl,
  hasManualEscudo,
} from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { LatLng } from '@cultuvilla/shared/models/core/LocationDataModel';

const ACCENT = '#bb5d3a';

/**
 * Organizer-only community editor (escudo, cover images, description,
 * coordinates). Content-only so it embeds in the shared community screen
 * behind a role gate, and in the legacy /admin/community wrapper.
 */
export function CommunitySettingsEditor({ villageId }: { villageId: string }) {
  const { t } = useT();
  const [village, setVillage] = useState<MunicipalityData | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingEscudo, setUploadingEscudo] = useState(false);

  const load = useCallback(async () => {
    if (!villageId) return;
    const m = await getMunicipality(villageId);
    setVillage(m);
    setDescription(m?.community?.description ?? '');
    setImages(m?.community?.coverImages ?? []);
    setLat(m?.coordinates ? String(m.coordinates.lat) : '');
    setLng(m?.coordinates ? String(m.coordinates.lng) : '');
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

  async function addImage() {
    if (!villageId) return;
    const picked = await pickImageAsBlob();
    if (!picked) return;
    setUploading(true);
    try {
      const url = await uploadMunicipalityImage(villageId, picked);
      setImages((prev) => [...prev, url]);
    } catch (e) {
      showAlert(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
  }

  function parseCoordinates(): LatLng | null | false {
    const latTrim = lat.trim();
    const lngTrim = lng.trim();
    if (latTrim === '' && lngTrim === '') return null;
    const latNum = Number(latTrim);
    const lngNum = Number(lngTrim);
    const valid =
      Number.isFinite(latNum) && latNum >= -90 && latNum <= 90 &&
      Number.isFinite(lngNum) && lngNum >= -180 && lngNum <= 180;
    return valid ? { lat: latNum, lng: lngNum } : false;
  }

  async function save() {
    if (!villageId || description === null) return;
    const coordinates = parseCoordinates();
    if (coordinates === false) {
      showAlert(t('village.admin.community.invalidCoordinates'));
      return;
    }
    setSaving(true);
    try {
      await updateCommunity(villageId, { description, coverImages: images });
      await updateMunicipality(villageId, { coordinates });
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

        <Text variant="h3" className="mt-2">{t('village.admin.community.images')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
          {images.map((url) => (
            <View key={url} className="relative">
              <Image source={{ uri: url }} className="w-40 h-28 rounded-xl" resizeMode="cover" />
              <Pressable
                onPress={() => removeImage(url)}
                accessibilityLabel={t('common.delete')}
                className="absolute top-1 right-1 bg-black/60 rounded-full p-1"
              >
                <Ionicons name="close" size={16} color="#fff" />
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={addImage}
            accessibilityLabel={t('village.admin.community.addImage')}
            className="w-40 h-28 border border-dashed border-subtle rounded-xl items-center justify-center"
          >
            <Ionicons name={uploading ? 'cloud-upload-outline' : 'add'} size={28} color={ACCENT} />
            <Text variant="bodySm" className="mt-1 font-medium">{t('village.admin.community.addImage')}</Text>
          </Pressable>
        </ScrollView>

        <Text variant="h3" className="mt-2">{t('village.admin.community.description')}</Text>
        <Input value={description ?? ''} onChangeText={setDescription} multiline placeholder={t('village.admin.community.description')} />

        <Text variant="h3" className="mt-2">{t('village.admin.community.coordinates')}</Text>
        <HStack gap={3}>
          <View className="flex-1">
            <Input label={t('village.admin.community.latitude')} value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" placeholder="40.4168" />
          </View>
          <View className="flex-1">
            <Input label={t('village.admin.community.longitude')} value={lng} onChangeText={setLng} keyboardType="numbers-and-punctuation" placeholder="-3.7038" />
          </View>
        </HStack>

        <Button onPress={save} loading={saving} disabled={uploading || uploadingEscudo}>
          {t('common.save')}
        </Button>
      </VStack>
    </ScrollView>
  );
}
