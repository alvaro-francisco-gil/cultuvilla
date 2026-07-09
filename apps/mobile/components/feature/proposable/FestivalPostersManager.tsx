import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
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
import { monthShortLabels } from '@cultuvilla/shared/utils';
import { VStack, HStack, Text, Button, Input, Pressable, FieldLabel, ImagePickerField } from '../../primitives';
import { pickImageAsBlob } from '../../../lib/images';
import { useT } from '../../../lib/i18n';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { isProposalVisible } from '../../../lib/proposals';
import { ProposableListItem } from './ProposableListItem';
import type { ManagerMode } from './types';

// Month chip labels derive from the locale formatter (es-ES month names),
// not a hardcoded list — see @cultuvilla/shared/utils/format.ts.
const MONTHS = monthShortLabels();
const PRECISIONS: DatePrecision[] = ['year', 'month', 'day'];

function precisionLabelKey(p: DatePrecision): 'precisionYear' | 'precisionMonth' | 'precisionDay' {
  return p === 'year' ? 'precisionYear' : p === 'month' ? 'precisionMonth' : 'precisionDay';
}

function computeDates(
  precision: DatePrecision,
  year: number,
  monthIndex: number,
  startDay: number,
  endDay: number,
): { startsAt: Date | null; endsAt: Date | null } {
  if (precision === 'year') return { startsAt: null, endsAt: null };
  if (precision === 'month') return { startsAt: new Date(year, monthIndex, 1), endsAt: null };
  return { startsAt: new Date(year, monthIndex, startDay), endsAt: new Date(year, monthIndex, endDay) };
}

function Stepper({ value, onChange, testID }: { value: number; onChange: (n: number) => void; testID?: string }) {
  return (
    <HStack gap={2} align="center">
      <Pressable
        testID={testID ? `${testID}-dec` : undefined}
        onPress={() => onChange(Math.max(1, value - 1))}
        className="w-8 h-8 rounded-full border border-subtle items-center justify-center"
      >
        <Ionicons name="remove" size={18} />
      </Pressable>
      <Text testID={testID}>{value}</Text>
      <Pressable
        testID={testID ? `${testID}-inc` : undefined}
        onPress={() => onChange(Math.min(31, value + 1))}
        className="w-8 h-8 rounded-full border border-subtle items-center justify-center"
      >
        <Ionicons name="add" size={18} />
      </Pressable>
    </HStack>
  );
}

/**
 * Carteles de fiestas surface, split by `mode`:
 * - `create` (default): the "Añadir cartel" form — year, optional title,
 *   date precision (solo año / mes / días) and the poster image. A villager
 *   proposes (pending); an organizer creates directly.
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
  const [precision, setPrecision] = useState<DatePrecision>('year');
  const [monthIndex, setMonthIndex] = useState(7);
  const [startDay, setStartDay] = useState(1);
  const [endDay, setEndDay] = useState(1);
  const [image, setImage] = useState<UploadableImage | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editYear, setEditYear] = useState(String(new Date().getFullYear()));
  const [editTitle, setEditTitle] = useState('');
  const [editPrecision, setEditPrecision] = useState<DatePrecision>('year');
  const [editMonthIndex, setEditMonthIndex] = useState(7);
  const [editStartDay, setEditStartDay] = useState(1);
  const [editEndDay, setEditEndDay] = useState(1);

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
      const { startsAt, endsAt } = computeDates(precision, y, monthIndex, startDay, endDay);
      const payload = {
        municipalityId: villageId,
        year: y,
        title: title.trim() || null,
        imageURL,
        datePrecision: precision,
        startsAt,
        endsAt,
        createdAt: new Date(),
      };
      if (canManage) await createFestivalPoster(payload, id);
      else await proposeFestivalPoster({ ...payload, proposedBy: uid }, id);
      setYear(String(new Date().getFullYear()));
      setTitle('');
      setPrecision('year');
      setMonthIndex(7);
      setStartDay(1);
      setEndDay(1);
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
      const { startsAt, endsAt } = computeDates(editPrecision, y, editMonthIndex, editStartDay, editEndDay);
      await updateFestivalPoster(editingId, {
        year: y,
        title: editTitle.trim() || null,
        datePrecision: editPrecision,
        startsAt,
        endsAt,
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

  const PrecisionPicker = ({
    value,
    onChange,
  }: {
    value: DatePrecision;
    onChange: (p: DatePrecision) => void;
  }) => (
    <VStack gap={1}>
      <FieldLabel>{t('village.festivalPosters.form.precision')}</FieldLabel>
      <HStack gap={2} className="flex-wrap">
        {PRECISIONS.map((p) => (
          <Pressable
            key={p}
            testID={`precision-${p}`}
            onPress={() => onChange(p)}
            className={`px-3 py-1 rounded-full border ${value === p ? 'bg-[#f3a64b] border-[#f3a64b]' : 'border-subtle'}`}
          >
            <Text className={value === p ? 'text-primary' : undefined}>
              {t(`village.festivalPosters.form.${precisionLabelKey(p)}`)}
            </Text>
          </Pressable>
        ))}
      </HStack>
    </VStack>
  );

  const MonthPicker = ({ value, onChange }: { value: number; onChange: (i: number) => void }) => (
    <VStack gap={1}>
      <FieldLabel>{t('village.festivalPosters.form.month')}</FieldLabel>
      <HStack gap={2} className="flex-wrap">
        {MONTHS.map((label, i) => (
          <Pressable
            key={label}
            testID={`month-${i}`}
            onPress={() => onChange(i)}
            className={`px-3 py-1 rounded-full border ${value === i ? 'bg-[#f3a64b] border-[#f3a64b]' : 'border-subtle'}`}
          >
            <Text className={value === i ? 'text-primary' : undefined}>{label}</Text>
          </Pressable>
        ))}
      </HStack>
    </VStack>
  );

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
          onChangeText={setYear}
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

        <PrecisionPicker value={precision} onChange={setPrecision} />

        {precision !== 'year' ? <MonthPicker value={monthIndex} onChange={setMonthIndex} /> : null}

        {precision === 'day' ? (
          <HStack gap={4}>
            <VStack gap={1}>
              <FieldLabel>{t('village.festivalPosters.form.startDay')}</FieldLabel>
              <Stepper testID="poster-start-day" value={startDay} onChange={setStartDay} />
            </VStack>
            <VStack gap={1}>
              <FieldLabel>{t('village.festivalPosters.form.endDay')}</FieldLabel>
              <Stepper testID="poster-end-day" value={endDay} onChange={setEndDay} />
            </VStack>
          </HStack>
        ) : null}

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
              onChangeText={setEditYear}
              label={t('village.festivalPosters.form.year')}
              keyboardType="number-pad"
            />
            <Input
              value={editTitle}
              onChangeText={setEditTitle}
              label={t('village.festivalPosters.form.title')}
            />
            <PrecisionPicker value={editPrecision} onChange={setEditPrecision} />
            {editPrecision !== 'year' ? <MonthPicker value={editMonthIndex} onChange={setEditMonthIndex} /> : null}
            {editPrecision === 'day' ? (
              <HStack gap={4}>
                <Stepper value={editStartDay} onChange={setEditStartDay} />
                <Stepper value={editEndDay} onChange={setEditEndDay} />
              </HStack>
            ) : null}
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
            subtitle={item.datePrecision !== 'year' ? MONTHS[item.startsAt?.getMonth() ?? 0] : null}
            status={item.status}
            canManage={canManage}
            isOwnPending={!canManage && item.status === 'pending' && item.proposedBy === uid}
            onApprove={uid ? () => void approveFestivalPoster(item.id, uid).then(load) : undefined}
            onReject={uid ? () => void rejectFestivalPoster(item.id, uid).then(load) : undefined}
            onEdit={() => {
              setEditingId(item.id);
              setEditYear(String(item.year));
              setEditTitle(item.title ?? '');
              setEditPrecision(item.datePrecision);
              setEditMonthIndex(item.startsAt?.getMonth() ?? 7);
              setEditStartDay(item.startsAt?.getDate() ?? 1);
              setEditEndDay(item.endsAt?.getDate() ?? 1);
            }}
            onWithdraw={() => void remove(item.id)}
            onDelete={() => void remove(item.id)}
          />
        ),
      )}
    </VStack>
  );
}
