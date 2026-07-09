import { useCallback, useEffect, useState } from 'react';
import {
  newFestivalPosterId,
  proposeFestivalPoster,
  createFestivalPoster,
  getFestivalPosters,
  approveFestivalPoster,
  rejectFestivalPoster,
  updateFestivalPoster,
  deleteFestivalPoster,
  type FestivalPosterWithId,
} from '@cultuvilla/shared/services/festivalPosterService';
import { uploadFestivalPosterImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import type { DatePrecision } from '@cultuvilla/shared/models/festivalPoster';
import { formatFestivalPosterDates } from '@cultuvilla/shared/utils';
import { VStack, HStack, Text, Button, Input, FieldLabel, DateField, ImagePickerField } from '../../primitives';
import { pickImageAsBlob } from '../../../lib/images';
import { useT } from '../../../lib/i18n';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { isProposalVisible } from '../../../lib/proposals';
import { ProposableListItem } from './ProposableListItem';
import type { ManagerMode } from './types';

/** Keep the year field digits-only (max 4) regardless of keyboard/platform. */
function sanitizeYear(text: string): string {
  return text.replace(/[^0-9]/g, '').slice(0, 4);
}

/**
 * Fold the two optional date pickers into the model's precision + range:
 * no start date → 'year' (dates dropped); a start date → 'day' (with an
 * optional end date). An end date without a start is ignored.
 */
function datesToPayload(
  startsAt: Date | null,
  endsAt: Date | null,
): { datePrecision: DatePrecision; startsAt: Date | null; endsAt: Date | null } {
  if (!startsAt) return { datePrecision: 'year', startsAt: null, endsAt: null };
  return { datePrecision: 'day', startsAt, endsAt: endsAt ?? null };
}

/**
 * Carteles de fiestas surface, split by `mode`:
 * - `create` (default): the "Añadir cartel" form — year, optional title,
 *   optional start/end dates and the poster image. A villager proposes
 *   (pending); an organizer creates directly.
 * - `manage`: the moderation list (approve/reject/edit/delete), mirroring
 *   PlacesManager's manage-mode.
 */
export function FestivalPostersManager({
  villageId,
  mode = 'create',
  onCreated,
}: {
  villageId: string;
  mode?: ManagerMode;
  onCreated?: () => void;
}) {
  const { t } = useT();
  const { canManage, uid } = useEntityCapabilities(villageId);
  const [rows, setRows] = useState<FestivalPosterWithId[] | null>(null);

  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [image, setImage] = useState<UploadableImage | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editYear, setEditYear] = useState(String(new Date().getFullYear()));
  const [editTitle, setEditTitle] = useState('');
  const [editStartsAt, setEditStartsAt] = useState<Date | null>(null);
  const [editEndsAt, setEditEndsAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!villageId) return;
    setRows(await getFestivalPosters(villageId));
  }, [villageId]);

  useEffect(() => {
    if (mode === 'manage') void load();
  }, [mode, load]);

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

  async function saveEdit() {
    const y = parseInt(editYear, 10);
    if (!editingId || !Number.isInteger(y)) return;
    setSaving(true);
    try {
      await updateFestivalPoster(editingId, {
        year: y,
        title: editTitle.trim() || null,
        ...datesToPayload(editStartsAt, editEndsAt),
      });
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  // No Alert.alert confirm — Alert is a no-op on web (the shared surface runs on web).
  async function remove(id: string) {
    await deleteFestivalPoster(id);
    await load();
  }

  if (mode === 'create') {
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

  // mode === 'manage': moderation list (no FlatList, so it nests in the
  // community screen's ScrollView without a nested-VirtualizedList warning).
  const visible = (rows ?? []).filter((r) => isProposalVisible(r.status, r.proposedBy, { canManage, uid }));
  return (
    <VStack gap={0} className="px-4">
      {rows && visible.length === 0 ? (
        <Text className="text-muted">{t('village.festivalPosters.empty')}</Text>
      ) : null}
      {visible.map((item) =>
        editingId === item.id ? (
          <VStack key={item.id} gap={2} className="py-3">
            <Input
              value={editYear}
              onChangeText={(txt) => setEditYear(sanitizeYear(txt))}
              label={t('village.festivalPosters.form.year')}
              keyboardType="number-pad"
            />
            <Input
              value={editTitle}
              onChangeText={setEditTitle}
              label={t('village.festivalPosters.form.title')}
            />
            <DateField
              label={t('village.festivalPosters.form.startDate')}
              value={editStartsAt}
              onChange={setEditStartsAt}
            />
            <DateField
              label={t('village.festivalPosters.form.endDate')}
              value={editEndsAt}
              onChange={setEditEndsAt}
            />
            <HStack gap={2}>
              <Button onPress={saveEdit} loading={saving}>{t('common.save')}</Button>
              <Button variant="ghost" onPress={() => setEditingId(null)}>{t('common.cancel')}</Button>
            </HStack>
          </VStack>
        ) : (
          <ProposableListItem
            key={item.id}
            name={`${item.year}${item.title ? ` · ${item.title}` : ''}`}
            imageURL={item.imageURL}
            subtitle={formatFestivalPosterDates(item)}
            status={item.status}
            canManage={canManage}
            isOwnPending={!canManage && item.status === 'pending' && item.proposedBy === uid}
            onApprove={uid ? () => void approveFestivalPoster(item.id, uid).then(load) : undefined}
            onReject={uid ? () => void rejectFestivalPoster(item.id, uid).then(load) : undefined}
            onEdit={() => {
              setEditingId(item.id);
              setEditYear(String(item.year));
              setEditTitle(item.title ?? '');
              setEditStartsAt(item.startsAt);
              setEditEndsAt(item.endsAt);
            }}
            onWithdraw={() => void remove(item.id)}
            onDelete={() => void remove(item.id)}
          />
        ),
      )}
    </VStack>
  );
}
