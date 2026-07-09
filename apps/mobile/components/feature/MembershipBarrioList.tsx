import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { VStack, HStack, Text, Escudo, FieldLabel, BarrioPicker } from '../primitives';
import { useT } from '../../lib/i18n';
import { getUserMemberships } from '@cultuvilla/shared/services/villageMemberService';
import {
  getPersonByUserId,
  updateResidenceBarrio,
} from '@cultuvilla/shared/services/personService';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { escudoThumbDisplayUrl } from '@cultuvilla/shared/models/municipality';

interface Row {
  municipalityId: string;
  name: string;
  escudoThumbUrl: string | null;
  barrioId: string | null;
}

export interface MembershipBarrioListProps {
  /** The account whose memberships are edited (the caller's own uid). */
  userId: string;
}

/**
 * Residence editor for the caller's own persona: one row per village they
 * belong to, each with a barrio picker. Residence barrio is single-source-of-
 * truth on the person's `municipalityLinks`, so the row value is read from there
 * and a change writes the person doc directly (`updateResidenceBarrio`) — no
 * membership write, no projection trigger. Villages are joined/left elsewhere
 * (discovery), so there is no add/remove here.
 */
export function MembershipBarrioList({ userId }: MembershipBarrioListProps) {
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [memberships, person] = await Promise.all([
        getUserMemberships(userId),
        getPersonByUserId(userId),
      ]);
      const links = person?.municipalityLinks ?? [];
      const named = await Promise.all(
        memberships.map(async (m) => {
          const muni = await getMunicipality(m.municipalityId);
          const link = links.find((l) => l.municipalityId === m.municipalityId);
          return {
            municipalityId: m.municipalityId,
            name: muni?.name ?? m.municipalityId,
            escudoThumbUrl: muni ? escudoThumbDisplayUrl(muni) : null,
            barrioId: link?.barrioId ?? null,
          };
        }),
      );
      if (!cancelled) setRows(named);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function onChangeBarrio(municipalityId: string, barrioId: string | null) {
    // Optimistic local update; the write is fire-and-forget per row.
    setRows((prev) =>
      (prev ?? []).map((r) => (r.municipalityId === municipalityId ? { ...r, barrioId } : r)),
    );
    await updateResidenceBarrio(userId, municipalityId, barrioId);
  }

  if (rows === null) {
    return (
      <View className="py-4 items-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <VStack gap={3}>
      <FieldLabel>{t('profile.personForm.myVillagesHeading')}</FieldLabel>
      {rows.length === 0 ? (
        <Text tone="muted" variant="bodySm">
          {t('profile.personForm.noVillages')}
        </Text>
      ) : (
        rows.map((r) => (
          <VStack key={r.municipalityId} gap={1}>
            <HStack gap={2} className="items-center">
              <Escudo url={r.escudoThumbUrl} size={28} fallbackInitial={r.name} />
              <Text className="font-semibold">{r.name}</Text>
            </HStack>
            <BarrioPicker
              label={t('profile.personForm.barrio')}
              municipalityId={r.municipalityId}
              value={r.barrioId}
              onChange={(barrioId) => void onChangeBarrio(r.municipalityId, barrioId)}
              wholeVillageLabel={t('profile.personForm.wholeVillage')}
            />
          </VStack>
        ))
      )}
    </VStack>
  );
}
