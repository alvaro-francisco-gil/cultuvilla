import { useState } from 'react';
import {
  newFestivalPosterId,
  proposeFestivalPoster,
  createFestivalPoster,
} from '@cultuvilla/shared/services/festivalPosterService';
import { uploadFestivalPosterImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import { VStack, Button, Input, FieldLabel, DateField, ImagePickerField } from '../../primitives';
import { pickImageAsBlob } from '../../../lib/images';
import { useT } from '../../../lib/i18n';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { sanitizeYear, datesToPayload } from './festivalPosterForm';

/**
 * "Añadir cartel" form — year, optional title, optional start/end dates and the
 * poster image. A villager proposes (pending); an organizer creates directly.
 * Editing/deleting a poster lives on the poster's own edit screen, not here.
 */
export function FestivalPostersManager({
  villageId,
  onCreated,
}: {
  villageId: string;
  onCreated?: () => void;
}) {
  const { t } = useT();
  const { canManage, uid } = useEntityCapabilities(villageId);

  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [image, setImage] = useState<UploadableImage | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const y = parseInt(year, 10);
    if (!villageId || !uid || !Number.isInteger(y) || !image) return;
    setSaving(true);
    try {
      const id = newFestivalPosterId();
      const imageURL = await uploadFestivalPosterImage(villageId, id, image);
      const payload = {
        municipalityId: villageId,
        year: y,
        title: title.trim() || null,
        imageURL,
        ...datesToPayload(startsAt, endsAt),
        createdAt: new Date(),
      };
      if (canManage) await createFestivalPoster(payload, id);
      else await proposeFestivalPoster({ ...payload, proposedBy: uid }, id);
      setYear(String(new Date().getFullYear()));
      setTitle('');
      setStartsAt(null);
      setEndsAt(null);
      setImage(null);
      onCreated?.();
    } finally {
      setSaving(false);
    }
  }

  const y = parseInt(year, 10);
  return (
    <VStack gap={3} className="p-4">
      <VStack gap={1} align="start">
        <FieldLabel>{t('village.festivalPosters.form.image')}</FieldLabel>
        <ImagePickerField
          uri={image?.previewUri ?? null}
          onPress={async () => {
            const picked = await pickImageAsBlob();
            if (picked) setImage(picked);
          }}
          label={t('village.festivalPosters.form.image')}
        />
      </VStack>

      <Input
        testID="poster-year-input"
        value={year}
        onChangeText={(txt) => setYear(sanitizeYear(txt))}
        label={t('village.festivalPosters.form.year')}
        keyboardType="number-pad"
      />

      <Input
        testID="poster-title-input"
        value={title}
        onChangeText={setTitle}
        label={t('village.festivalPosters.form.title')}
        placeholder={t('village.festivalPosters.form.titlePlaceholder')}
      />

      <DateField
        testID="poster-start-date"
        label={t('village.festivalPosters.form.startDate')}
        value={startsAt}
        onChange={setStartsAt}
      />
      <DateField
        testID="poster-end-date"
        label={t('village.festivalPosters.form.endDate')}
        value={endsAt}
        onChange={setEndsAt}
      />

      <Button
        testID="poster-submit"
        onPress={submit}
        loading={saving}
        disabled={!Number.isInteger(y) || !image}
      >
        {canManage ? t('village.festivalPosters.add') : t('village.festivalPosters.propose')}
      </Button>
    </VStack>
  );
}
