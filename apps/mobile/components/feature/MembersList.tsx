import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getVillageMembers } from '@cultuvilla/shared/services/villageMemberService';
import { getUserProfile } from '@cultuvilla/shared/services/userService';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { formatDate } from '@cultuvilla/shared/utils';
import { VStack, HStack, Text, Avatar } from '../primitives';
import { useT } from '../../lib/i18n';

interface MemberRow {
  userId: string;
  role: 'admin' | 'user';
  joinedAt: Date;
  censoComplete: boolean;
  displayName: string;
  photoURL: string | null;
}

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/**
 * Read-only roster of a pueblo's members, mounted as the "Miembros" tab of the
 * community ("Editar pueblo") screen. Rendered as a table: Nombre · Censo · Fecha.
 * Joins each member doc with the user profile for name/photo, lists admins first,
 * then by join date. No mutations yet — admin removal is a later addition
 * (removeVillageMember already exists).
 */
export function MembersList({ villageId }: { villageId: string }) {
  const { t } = useT();
  const [rows, setRows] = useState<MemberRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const members = await getVillageMembers(villageId);
      const joined = await Promise.all(
        members.map(async (m) => {
          // Name comes from the (denormalized) user doc; the avatar lives on the
          // person doc — the user doc's photoURL is frequently null.
          const [profile, person] = await Promise.all([
            getUserProfile(m.userId),
            getPersonByUserId(m.userId),
          ]);
          return {
            userId: m.userId,
            role: m.role,
            joinedAt: m.joinedAt,
            censoComplete: m.profileCompletedAt != null,
            displayName: profile?.displayName ?? '',
            photoURL: person?.photoURL ?? null,
          };
        }),
      );
      joined.sort((a, b) => {
        if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
        return a.joinedAt.getTime() - b.joinedAt.getTime();
      });
      if (!cancelled) setRows(joined);
    })();
    return () => {
      cancelled = true;
    };
  }, [villageId]);

  if (rows === null) {
    return (
      <VStack className="flex-1 items-center justify-center py-10">
        <ActivityIndicator />
      </VStack>
    );
  }

  if (rows.length === 0) {
    return (
      <VStack className="items-center py-10 px-4">
        <Text tone="muted">{t('village.membersList.empty')}</Text>
      </VStack>
    );
  }

  return (
    <ScrollView contentContainerClassName="pb-10">
      <VStack className="pt-3 px-4">
        {/* Header row */}
        <HStack className="items-center py-2 border-b border-subtle">
          <Text variant="caption" tone="muted" numberOfLines={1} className="flex-1 font-bold">
            {t('village.membersList.colName')}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1} className="w-14 text-center font-bold">
            {t('village.membersList.colCenso')}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1} className="w-32 text-right font-bold">
            {t('village.membersList.colDate')}
          </Text>
        </HStack>

        {/* Member rows */}
        {rows.map((m) => (
          <HStack key={m.userId} className="items-center py-3 border-b border-subtle">
            <HStack gap={2} className="flex-1 items-center pr-2">
              <Avatar uri={m.photoURL} size={32} initials={initialsOf(m.displayName)} />
              <Text testID="member-name" numberOfLines={1} className="flex-1">
                {m.displayName}
              </Text>
            </HStack>
            <View
              className="w-14 items-center"
              accessibilityLabel={
                m.censoComplete
                  ? t('village.membersList.censoComplete')
                  : t('village.membersList.censoPending')
              }
            >
              <Ionicons
                name={m.censoComplete ? 'checkmark' : 'close'}
                size={18}
                color={m.censoComplete ? '#16a34a' : '#9ca3af'}
              />
            </View>
            <Text variant="caption" tone="muted" numberOfLines={1} className="w-32 text-right">
              {formatDate(m.joinedAt, 'short')}
            </Text>
          </HStack>
        ))}
      </VStack>
    </ScrollView>
  );
}
